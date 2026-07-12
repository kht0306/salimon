-- Keep customized default categories stable across workspace initialization.
create temporary table category_duplicate_map on commit drop as
with ranked as (
  select
    id,
    first_value(id) over (
      partition by ledger_id, type, sort_order
      order by created_at, id
    ) as keep_id,
    row_number() over (
      partition by ledger_id, type, sort_order
      order by created_at, id
    ) as duplicate_number
  from public.categories
  where is_default
)
select id as duplicate_id, keep_id
from ranked
where duplicate_number > 1;

update public.transactions txn
set category_id = duplicate.keep_id
from category_duplicate_map duplicate
where txn.category_id = duplicate.duplicate_id;

update public.recurring_rules rule
set category_id = duplicate.keep_id
from category_duplicate_map duplicate
where rule.category_id = duplicate.duplicate_id;

delete from public.category_budgets duplicate_budget
using category_duplicate_map duplicate
where duplicate_budget.category_id = duplicate.duplicate_id
  and exists (
    select 1
    from public.category_budgets kept_budget
    where kept_budget.category_id = duplicate.keep_id
      and kept_budget.effective_month = duplicate_budget.effective_month
  );

update public.category_budgets budget
set category_id = duplicate.keep_id
from category_duplicate_map duplicate
where budget.category_id = duplicate.duplicate_id;

delete from public.categories category
using category_duplicate_map duplicate
where category.id = duplicate.duplicate_id;

create unique index if not exists categories_default_slot_uidx
on public.categories (ledger_id, type, sort_order)
where is_default;

-- Store every option that must be applied consistently across an installment series.
alter table public.recurring_rules
  add column if not exists transaction_type text not null default 'expense'
    check (transaction_type in ('expense', 'income', 'transfer')),
  add column if not exists transaction_status text not null default 'confirmed'
    check (transaction_status in ('pending', 'confirmed', 'excluded')),
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null;

with first_transactions as (
  select distinct on (txn.recurring_rule_id)
    txn.recurring_rule_id,
    txn.type,
    txn.status,
    txn.actor_user_id
  from public.transactions txn
  where txn.recurring_rule_id is not null
    and txn.deleted_at is null
  order by txn.recurring_rule_id,
    txn.installment_number nulls last,
    txn.transaction_at
)
update public.recurring_rules rule
set
  transaction_type = first_transaction.type,
  transaction_status = first_transaction.status,
  actor_user_id = first_transaction.actor_user_id
from first_transactions first_transaction
where first_transaction.recurring_rule_id = rule.id;

create or replace function public.save_installment_series(
  p_rule_id uuid,
  p_ledger_id uuid,
  p_amount numeric,
  p_transaction_at timestamptz,
  p_installment_months int,
  p_category_id uuid,
  p_merchant_name text,
  p_memo text,
  p_actor_user_id uuid,
  p_status text,
  p_type text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  installment_rule_id uuid;
  rule_owner uuid;
  occurrence_no int;
  occurrence_at timestamptz;
  local_start timestamp := timezone('Asia/Seoul', p_transaction_at);
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not public.has_ledger_role(p_ledger_id, array['owner', 'admin', 'member']) then
    raise exception '할부 거래를 저장할 권한이 없습니다.';
  end if;
  if p_amount <= 0 then raise exception '납부액은 0보다 커야 합니다.'; end if;
  if p_installment_months not between 2 and 120 then
    raise exception '할부 개월은 2개월에서 120개월 사이여야 합니다.';
  end if;
  if p_status not in ('pending', 'confirmed', 'excluded') then
    raise exception '올바르지 않은 거래 상태입니다.';
  end if;
  if p_type not in ('expense', 'income', 'transfer') then
    raise exception '올바르지 않은 거래 유형입니다.';
  end if;

  if p_rule_id is null then
    insert into public.recurring_rules (
      ledger_id, created_by, rule_type, amount, day_of_month, time_of_day,
      start_month, end_month, installment_months, category_id, merchant_name,
      memo, transaction_type, transaction_status, actor_user_id, is_active
    ) values (
      p_ledger_id, auth.uid(), 'installment', p_amount,
      extract(day from local_start)::int, local_start::time,
      date_trunc('month', local_start)::date,
      (date_trunc('month', local_start) + make_interval(months => p_installment_months - 1))::date,
      p_installment_months, p_category_id, p_merchant_name, p_memo,
      p_type, p_status, p_actor_user_id, true
    ) returning id, created_by into installment_rule_id, rule_owner;
  else
    select id, created_by into installment_rule_id, rule_owner
    from public.recurring_rules
    where id = p_rule_id and ledger_id = p_ledger_id and rule_type = 'installment';

    if installment_rule_id is null then raise exception '할부 규칙을 찾을 수 없습니다.'; end if;

    update public.recurring_rules
    set amount = p_amount,
        day_of_month = extract(day from local_start)::int,
        time_of_day = local_start::time,
        start_month = date_trunc('month', local_start)::date,
        end_month = (date_trunc('month', local_start) + make_interval(months => p_installment_months - 1))::date,
        inactive_from_month = null,
        installment_months = p_installment_months,
        category_id = p_category_id,
        merchant_name = p_merchant_name,
        memo = p_memo,
        transaction_type = p_type,
        transaction_status = p_status,
        actor_user_id = p_actor_user_id,
        is_active = true,
        updated_at = now()
    where id = installment_rule_id;
  end if;

  for occurrence_no in 1..p_installment_months loop
    occurrence_at := p_transaction_at + make_interval(months => occurrence_no - 1);
    insert into public.transactions (
      ledger_id, created_by, updated_by, actor_user_id, type, status, amount,
      currency, transaction_at, category_id, merchant_name, memo, source_type,
      recurring_rule_id, recurring_type, installment_number, installment_total
    ) values (
      p_ledger_id, rule_owner, auth.uid(), p_actor_user_id, p_type, p_status,
      p_amount, 'KRW', occurrence_at, p_category_id, p_merchant_name, p_memo,
      'manual', installment_rule_id, 'installment', occurrence_no,
      p_installment_months
    )
    on conflict (recurring_rule_id, installment_number)
      where recurring_rule_id is not null and deleted_at is null
    do update set
      updated_by = auth.uid(),
      actor_user_id = excluded.actor_user_id,
      type = excluded.type,
      status = excluded.status,
      amount = excluded.amount,
      transaction_at = excluded.transaction_at,
      category_id = excluded.category_id,
      merchant_name = excluded.merchant_name,
      memo = excluded.memo,
      installment_total = excluded.installment_total,
      updated_at = now();
  end loop;

  update public.transactions
  set deleted_at = now(), updated_by = auth.uid(), updated_at = now()
  where recurring_rule_id = installment_rule_id
    and deleted_at is null
    and installment_number > p_installment_months;

  return installment_rule_id;
end;
$$;

revoke all on function public.save_installment_series(uuid, uuid, numeric, timestamptz, int, uuid, text, text, uuid, text, text) from public;
grant execute on function public.save_installment_series(uuid, uuid, numeric, timestamptz, int, uuid, text, text, uuid, text, text) to authenticated;

-- Materialize every missing occurrence for installment rules that already exist.
insert into public.transactions (
  ledger_id, created_by, updated_by, actor_user_id, type, status, amount,
  currency, transaction_at, category_id, merchant_name, memo, source_type,
  recurring_rule_id, recurring_type, installment_number, installment_total
)
select
  rule.ledger_id, rule.created_by, rule.created_by, rule.actor_user_id,
  rule.transaction_type, rule.transaction_status, rule.amount, 'KRW',
  (
    make_date(
      extract(year from (rule.start_month + make_interval(months => occurrence.number - 1)))::int,
      extract(month from (rule.start_month + make_interval(months => occurrence.number - 1)))::int,
      least(
        rule.day_of_month,
        extract(day from (date_trunc('month', rule.start_month + make_interval(months => occurrence.number)) - interval '1 day'))::int
      )
    ) + rule.time_of_day
  )::timestamptz,
  rule.category_id, rule.merchant_name, rule.memo, 'manual', rule.id,
  'installment', occurrence.number, rule.installment_months
from public.recurring_rules rule
cross join lateral generate_series(1, rule.installment_months) occurrence(number)
where rule.rule_type = 'installment'
  and rule.installment_months is not null
on conflict (recurring_rule_id, installment_number)
  where recurring_rule_id is not null and deleted_at is null
do nothing;

create or replace function public.materialize_finance_month(target_month date)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  rule public.recurring_rules%rowtype;
  month_start date := date_trunc('month', target_month)::date;
  occurrence_no int;
  occurrence_date date;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  for rule in select * from public.recurring_rules r
    where public.is_ledger_member(r.ledger_id)
      and r.start_month <= month_start
      and (r.end_month is null or r.end_month >= month_start)
      and (r.inactive_from_month is null or r.inactive_from_month > month_start)
  loop
    occurrence_no := ((extract(year from month_start)::int - extract(year from rule.start_month)::int) * 12
      + extract(month from month_start)::int - extract(month from rule.start_month)::int) + 1;
    if rule.rule_type = 'installment' and occurrence_no > coalesce(rule.installment_months, 0) then continue; end if;
    occurrence_date := make_date(extract(year from month_start)::int, extract(month from month_start)::int,
      least(rule.day_of_month, extract(day from (month_start + interval '1 month - 1 day'))::int));
    insert into public.transactions (
      ledger_id, created_by, updated_by, actor_user_id, type, status, amount, currency,
      transaction_at, category_id, merchant_name, memo, source_type, recurring_rule_id,
      recurring_type, installment_number, installment_total
    ) values (
      rule.ledger_id, rule.created_by, rule.created_by, rule.actor_user_id,
      rule.transaction_type, rule.transaction_status, rule.amount, 'KRW',
      occurrence_date + rule.time_of_day, rule.category_id, rule.merchant_name,
      rule.memo, 'manual', rule.id, rule.rule_type, occurrence_no,
      case when rule.rule_type = 'installment' then rule.installment_months else null end
    ) on conflict (recurring_rule_id, installment_number)
      where recurring_rule_id is not null and deleted_at is null do nothing;
  end loop;
end;
$$;

grant execute on function public.materialize_finance_month(date) to authenticated;
