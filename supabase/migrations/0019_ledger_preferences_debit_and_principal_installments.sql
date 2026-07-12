alter table public.ledger_members
  add column if not exists is_default boolean not null default false;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by (status = 'active') desc, joined_at, id
    ) as ledger_number
  from public.ledger_members
  where status = 'active'
)
update public.ledger_members member
set is_default = ranked.ledger_number = 1
from ranked
where member.id = ranked.id
  and not exists (
    select 1
    from public.ledger_members existing
    where existing.user_id = member.user_id
      and existing.status = 'active'
      and existing.is_default
  );

create unique index if not exists ledger_members_user_default_uidx
on public.ledger_members (user_id)
where status = 'active' and is_default;

create or replace function public.set_default_ledger(p_ledger_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not exists (
    select 1
    from public.ledger_members
    where ledger_id = p_ledger_id
      and user_id = auth.uid()
      and status = 'active'
  ) then
    raise exception '참여 중인 가계부만 기본으로 설정할 수 있습니다.';
  end if;

  update public.ledger_members
  set is_default = false
  where user_id = auth.uid()
    and status = 'active'
    and is_default;

  update public.ledger_members
  set is_default = true
  where ledger_id = p_ledger_id
    and user_id = auth.uid()
    and status = 'active';
end;
$$;

revoke all on function public.set_default_ledger(uuid) from public;
grant execute on function public.set_default_ledger(uuid) to authenticated;

create or replace function public.convert_personal_ledger_to_shared(p_ledger_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not exists (
    select 1
    from public.ledgers
    where id = p_ledger_id
      and owner_id = auth.uid()
      and type = 'personal'
  ) then
    raise exception '소유한 개인 가계부만 공유로 전환할 수 있습니다.';
  end if;

  update public.ledgers
  set type = 'shared'
  where id = p_ledger_id;
end;
$$;

revoke all on function public.convert_personal_ledger_to_shared(uuid) from public;
grant execute on function public.convert_personal_ledger_to_shared(uuid) to authenticated;

alter table public.payment_methods
  add column if not exists is_debit boolean not null default false;

alter table public.recurring_rules
  add column if not exists installment_amount_type text not null default 'monthly'
    check (installment_amount_type in ('monthly', 'principal')),
  add column if not exists installment_principal numeric(14, 2)
    check (installment_principal is null or installment_principal > 0);

create or replace function public.save_card_installment_series_v2(
  p_rule_id uuid,
  p_ledger_id uuid,
  p_amount numeric,
  p_amount_type text,
  p_transaction_at timestamptz,
  p_installment_months int,
  p_category_id uuid,
  p_merchant_name text,
  p_memo text,
  p_actor_user_id uuid,
  p_status text,
  p_type text,
  p_payment_method_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  card public.payment_methods%rowtype;
  installment_rule_id uuid;
  rule_owner uuid;
  occurrence_no int;
  occurrence_at timestamptz;
  occurrence_amount numeric(14, 2);
  monthly_amount numeric(14, 2);
  principal_amount numeric(14, 2);
  local_purchase timestamp := timezone('Asia/Seoul', p_transaction_at);
  payment_month date := date_trunc('month', local_purchase)::date;
  cutoff_month date;
  cutoff_date date;
  first_payment_local timestamp;
  first_payment_at timestamptz;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not public.has_ledger_role(p_ledger_id, array['owner', 'admin', 'member']) then
    raise exception '할부 거래를 저장할 권한이 없습니다.';
  end if;
  if p_amount <= 0 then
    raise exception '금액은 0보다 커야 합니다.';
  end if;
  if p_installment_months not between 2 and 120 then
    raise exception '할부 개월은 2개월에서 120개월 사이여야 합니다.';
  end if;
  if p_amount_type not in ('monthly', 'principal') then
    raise exception '올바르지 않은 할부 금액 유형입니다.';
  end if;
  if p_amount_type = 'principal' and p_amount < p_installment_months then
    raise exception '할부 원금은 할부 개월 수 이상이어야 합니다.';
  end if;
  if p_status not in ('pending', 'confirmed', 'excluded') then
    raise exception '올바르지 않은 거래 상태입니다.';
  end if;
  if p_type not in ('expense', 'income', 'transfer') then
    raise exception '올바르지 않은 거래 유형입니다.';
  end if;

  select * into card
  from public.payment_methods
  where id = p_payment_method_id
    and ledger_id = p_ledger_id
    and type = 'card'
    and is_active
    and deleted_at is null;

  if card.id is null or card.payment_day is null
    or card.billing_period_end_day is null
    or card.billing_period_end_month_offset is null then
    raise exception '청구주기가 등록된 카드를 선택해 주세요.';
  end if;

  monthly_amount := case
    when p_amount_type = 'principal' then floor(p_amount / p_installment_months)
    else p_amount
  end;
  principal_amount := case
    when p_amount_type = 'principal' then p_amount
    else p_amount * p_installment_months
  end;

  cutoff_month := (payment_month + make_interval(months => card.billing_period_end_month_offset))::date;
  cutoff_date := make_date(
    extract(year from cutoff_month)::int,
    extract(month from cutoff_month)::int,
    least(
      card.billing_period_end_day,
      extract(day from (date_trunc('month', cutoff_month) + interval '1 month - 1 day'))::int
    )
  );
  if local_purchase::date > cutoff_date then
    payment_month := (payment_month + interval '1 month')::date;
  end if;

  first_payment_local := make_date(
    extract(year from payment_month)::int,
    extract(month from payment_month)::int,
    least(
      card.payment_day,
      extract(day from (date_trunc('month', payment_month) + interval '1 month - 1 day'))::int
    )
  ) + local_purchase::time;
  first_payment_at := first_payment_local at time zone 'Asia/Seoul';

  if p_rule_id is null then
    insert into public.recurring_rules (
      ledger_id, created_by, rule_type, amount, day_of_month, time_of_day,
      start_month, end_month, installment_months, installment_amount_type,
      installment_principal, purchase_at, payment_method_id, category_id,
      merchant_name, memo, transaction_type, transaction_status,
      actor_user_id, is_active
    ) values (
      p_ledger_id, auth.uid(), 'installment', monthly_amount,
      extract(day from timezone('Asia/Seoul', first_payment_at))::int,
      timezone('Asia/Seoul', first_payment_at)::time,
      date_trunc('month', timezone('Asia/Seoul', first_payment_at))::date,
      (date_trunc('month', timezone('Asia/Seoul', first_payment_at))
        + make_interval(months => p_installment_months - 1))::date,
      p_installment_months, p_amount_type, principal_amount, p_transaction_at,
      p_payment_method_id, p_category_id, p_merchant_name, p_memo, p_type,
      p_status, p_actor_user_id, true
    ) returning id, created_by into installment_rule_id, rule_owner;
  else
    select id, created_by into installment_rule_id, rule_owner
    from public.recurring_rules
    where id = p_rule_id
      and ledger_id = p_ledger_id
      and rule_type = 'installment';

    if installment_rule_id is null then
      raise exception '할부 규칙을 찾을 수 없습니다.';
    end if;

    update public.recurring_rules
    set
      amount = monthly_amount,
      day_of_month = extract(day from timezone('Asia/Seoul', first_payment_at))::int,
      time_of_day = timezone('Asia/Seoul', first_payment_at)::time,
      start_month = date_trunc('month', timezone('Asia/Seoul', first_payment_at))::date,
      end_month = (date_trunc('month', timezone('Asia/Seoul', first_payment_at))
        + make_interval(months => p_installment_months - 1))::date,
      inactive_from_month = null,
      installment_months = p_installment_months,
      installment_amount_type = p_amount_type,
      installment_principal = principal_amount,
      purchase_at = p_transaction_at,
      payment_method_id = p_payment_method_id,
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
    occurrence_at := first_payment_at + make_interval(months => occurrence_no - 1);
    occurrence_amount := case
      when p_amount_type = 'principal' and occurrence_no = p_installment_months
        then principal_amount - monthly_amount * (p_installment_months - 1)
      else monthly_amount
    end;

    insert into public.transactions (
      ledger_id, created_by, updated_by, actor_user_id, type, status, amount,
      currency, transaction_at, category_id, payment_method_id, merchant_name,
      memo, source_type, recurring_rule_id, recurring_type,
      installment_number, installment_total
    ) values (
      p_ledger_id, rule_owner, auth.uid(), p_actor_user_id, p_type, p_status,
      occurrence_amount, 'KRW', occurrence_at, p_category_id,
      p_payment_method_id, p_merchant_name, p_memo, 'manual',
      installment_rule_id, 'installment', occurrence_no, p_installment_months
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
      payment_method_id = excluded.payment_method_id,
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

revoke all on function public.save_card_installment_series_v2(
  uuid, uuid, numeric, text, timestamptz, int, uuid, text, text, uuid,
  text, text, uuid
) from public;
grant execute on function public.save_card_installment_series_v2(
  uuid, uuid, numeric, text, timestamptz, int, uuid, text, text, uuid,
  text, text, uuid
) to authenticated;

create or replace function public.materialize_finance_month(target_month date)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  rule public.recurring_rules%rowtype;
  month_start date := date_trunc('month', target_month)::date;
  occurrence_no int;
  occurrence_date date;
  occurrence_amount numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  for rule in
    select *
    from public.recurring_rules r
    where public.is_ledger_member(r.ledger_id)
      and r.start_month <= month_start
      and (r.end_month is null or r.end_month >= month_start)
      and (r.inactive_from_month is null or r.inactive_from_month > month_start)
  loop
    occurrence_no := (
      (extract(year from month_start)::int - extract(year from rule.start_month)::int) * 12
      + extract(month from month_start)::int
      - extract(month from rule.start_month)::int
    ) + 1;

    if rule.rule_type = 'installment'
      and occurrence_no > coalesce(rule.installment_months, 0) then
      continue;
    end if;

    if exists (
      select 1
      from public.transactions txn
      where txn.recurring_rule_id = rule.id
        and txn.installment_number = occurrence_no
    ) then
      continue;
    end if;

    occurrence_date := make_date(
      extract(year from month_start)::int,
      extract(month from month_start)::int,
      least(
        rule.day_of_month,
        extract(day from (month_start + interval '1 month - 1 day'))::int
      )
    );
    occurrence_amount := case
      when rule.rule_type = 'installment'
        and rule.installment_amount_type = 'principal'
        and occurrence_no = rule.installment_months
        then rule.installment_principal - rule.amount * (rule.installment_months - 1)
      else rule.amount
    end;

    insert into public.transactions (
      ledger_id, created_by, updated_by, actor_user_id, type, status, amount,
      currency, transaction_at, category_id, payment_method_id, merchant_name,
      memo, source_type, recurring_rule_id, recurring_type,
      installment_number, installment_total
    ) values (
      rule.ledger_id, rule.created_by, rule.created_by, rule.actor_user_id,
      rule.transaction_type, rule.transaction_status, occurrence_amount, 'KRW',
      occurrence_date + rule.time_of_day, rule.category_id,
      rule.payment_method_id, rule.merchant_name, rule.memo, 'manual', rule.id,
      rule.rule_type, occurrence_no,
      case when rule.rule_type = 'installment' then rule.installment_months else null end
    )
    on conflict (recurring_rule_id, installment_number)
      where recurring_rule_id is not null and deleted_at is null
    do nothing;
  end loop;
end;
$$;

grant execute on function public.materialize_finance_month(date) to authenticated;
