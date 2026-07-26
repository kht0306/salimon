-- Keep legacy installment schedules stable while new installments show their
-- first occurrence on the purchase date and later occurrences on the card's
-- payment day.

alter table public.encrypted_recurring_rules
  add column if not exists installment_schedule_type text
  not null default 'billing_cycle';

alter table public.encrypted_recurring_rules
  drop constraint if exists encrypted_recurring_rules_installment_schedule_check;
alter table public.encrypted_recurring_rules
  add constraint encrypted_recurring_rules_installment_schedule_check check (
    installment_schedule_type in (
      'billing_cycle',
      'purchase_then_payment_day'
    )
  );

create or replace function public.save_card_installment_series_v3(
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
  existing_schedule_type text;
  existing_transaction_id uuid;
  occurrence_no int;
  occurrence_month date;
  occurrence_local timestamp;
  occurrence_at timestamptz;
  occurrence_amount numeric(14, 2);
  monthly_amount numeric(14, 2);
  principal_amount numeric(14, 2);
  local_purchase timestamp := timezone('Asia/Seoul', p_transaction_at);
  purchase_month date := date_trunc('month', local_purchase)::date;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not public.has_ledger_role(p_ledger_id, array['owner', 'admin', 'member']) then
    raise exception '할부 거래를 저장할 권한이 없습니다.';
  end if;
  if p_amount <= 0 then raise exception '금액은 0보다 커야 합니다.'; end if;
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
  if p_type <> 'expense' then
    raise exception '할부는 지출 거래에만 설정할 수 있습니다.';
  end if;

  select * into card
  from public.payment_methods
  where id = p_payment_method_id and ledger_id = p_ledger_id
    and type = 'card' and is_active and deleted_at is null
    and (visibility = 'ledger' or owner_user_id = auth.uid());

  if card.id is null or card.payment_day is null then
    raise exception '결제일이 등록된 카드를 선택해 주세요.';
  end if;

  monthly_amount := case
    when p_amount_type = 'principal' then floor(p_amount / p_installment_months)
    else p_amount
  end;
  principal_amount := case
    when p_amount_type = 'principal' then p_amount
    else p_amount * p_installment_months
  end;

  if p_rule_id is null then
    insert into public.recurring_rules (
      ledger_id, created_by, rule_type, amount, day_of_month, time_of_day,
      start_month, end_month, installment_months, installment_amount_type,
      installment_principal, purchase_at, payment_method_id, category_id,
      merchant_name, memo, transaction_type, transaction_status,
      actor_user_id, is_active
    ) values (
      p_ledger_id, auth.uid(), 'installment', monthly_amount,
      card.payment_day, local_purchase::time, purchase_month,
      (purchase_month + make_interval(months => p_installment_months - 1))::date,
      p_installment_months, p_amount_type, principal_amount, p_transaction_at,
      p_payment_method_id, p_category_id, p_merchant_name, p_memo, p_type,
      p_status, p_actor_user_id, true
    ) returning id, created_by into installment_rule_id, rule_owner;

    update public.encrypted_recurring_rules
    set installment_schedule_type = 'purchase_then_payment_day'
    where id = installment_rule_id;
  else
    select
      recurring_rule.id,
      recurring_rule.created_by,
      encrypted_rule.installment_schedule_type
    into installment_rule_id, rule_owner, existing_schedule_type
    from public.recurring_rules recurring_rule
    join public.encrypted_recurring_rules encrypted_rule
      on encrypted_rule.id = recurring_rule.id
    where recurring_rule.id = p_rule_id
      and recurring_rule.ledger_id = p_ledger_id
      and recurring_rule.rule_type = 'installment';

    if installment_rule_id is null then
      raise exception '할부 규칙을 찾을 수 없습니다.';
    end if;
    if existing_schedule_type <> 'purchase_then_payment_day' then
      raise exception '기존 할부 일정은 새 방식으로 변경할 수 없습니다.';
    end if;

    update public.recurring_rules
    set amount = monthly_amount,
        day_of_month = card.payment_day,
        time_of_day = local_purchase::time,
        start_month = purchase_month,
        end_month = (
          purchase_month + make_interval(months => p_installment_months - 1)
        )::date,
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
    if occurrence_no = 1 then
      occurrence_at := p_transaction_at;
    else
      occurrence_month := (
        purchase_month + make_interval(months => occurrence_no - 1)
      )::date;
      occurrence_local := make_date(
        extract(year from occurrence_month)::int,
        extract(month from occurrence_month)::int,
        least(
          card.payment_day,
          extract(
            day from (occurrence_month + interval '1 month - 1 day')
          )::int
        )
      ) + local_purchase::time;
      occurrence_at := occurrence_local at time zone 'Asia/Seoul';
    end if;

    occurrence_amount := case
      when p_amount_type = 'principal' and occurrence_no = p_installment_months
        then principal_amount - monthly_amount * (p_installment_months - 1)
      else monthly_amount
    end;

    select id into existing_transaction_id
    from public.transactions
    where recurring_rule_id = installment_rule_id
      and installment_number = occurrence_no
      and deleted_at is null
    limit 1;

    if existing_transaction_id is null then
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
      );
    else
      update public.transactions
      set updated_by = auth.uid(),
          actor_user_id = p_actor_user_id,
          type = p_type,
          status = p_status,
          amount = occurrence_amount,
          transaction_at = occurrence_at,
          category_id = p_category_id,
          payment_method_id = p_payment_method_id,
          merchant_name = p_merchant_name,
          memo = p_memo,
          installment_total = p_installment_months,
          updated_at = now()
      where id = existing_transaction_id;
    end if;
  end loop;

  update public.transactions
  set deleted_at = now(), updated_by = auth.uid(), updated_at = now()
  where recurring_rule_id = installment_rule_id
    and deleted_at is null
    and installment_number > p_installment_months;

  return installment_rule_id;
end;
$$;

revoke all on function public.save_card_installment_series_v3(
  uuid, uuid, numeric, text, timestamptz, int, uuid, text, text, uuid,
  text, text, uuid
) from public;
grant execute on function public.save_card_installment_series_v3(
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
  rule record;
  month_start date := date_trunc('month', target_month)::date;
  occurrence_no int;
  occurrence_date date;
  occurrence_at timestamptz;
  occurrence_amount numeric(14, 2);
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;

  for rule in
    select
      recurring_rule.*,
      encrypted_rule.installment_schedule_type
    from public.recurring_rules recurring_rule
    join public.encrypted_recurring_rules encrypted_rule
      on encrypted_rule.id = recurring_rule.id
    where public.is_ledger_member(recurring_rule.ledger_id)
      and recurring_rule.start_month <= month_start
      and (
        recurring_rule.end_month is null
        or recurring_rule.end_month >= month_start
      )
      and (
        recurring_rule.inactive_from_month is null
        or recurring_rule.inactive_from_month > month_start
      )
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
      select 1 from public.transactions transaction
      where transaction.recurring_rule_id = rule.id
        and transaction.installment_number = occurrence_no
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
    occurrence_at := case
      when rule.rule_type = 'installment'
        and rule.installment_schedule_type = 'purchase_then_payment_day'
        and occurrence_no = 1
        then rule.purchase_at
      else (occurrence_date + rule.time_of_day) at time zone 'Asia/Seoul'
    end;
    occurrence_amount := case
      when rule.rule_type = 'installment'
        and rule.installment_amount_type = 'principal'
        and occurrence_no = rule.installment_months
        then rule.installment_principal - rule.amount * (rule.installment_months - 1)
      else rule.amount
    end;

    insert into public.encrypted_transactions (
      ledger_id, created_by, updated_by, actor_user_id, type, status, amount,
      currency, transaction_at, category_id, payment_method_id, merchant_name,
      memo, source_type, recurring_rule_id, recurring_type,
      installment_number, installment_total, private_payload,
      encryption_key_version, income_kind
    ) values (
      rule.ledger_id, rule.created_by, rule.created_by, rule.actor_user_id,
      rule.transaction_type, rule.transaction_status, 0, 'KRW',
      '1970-01-01 00:00:00+00', rule.category_id,
      rule.payment_method_id, null, null, 'manual', rule.id,
      rule.rule_type, occurrence_no,
      case when rule.rule_type = 'installment' then rule.installment_months else null end,
      private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
        'amount', occurrence_amount,
        'transaction_at', occurrence_at,
        'merchant_name', rule.merchant_name,
        'memo', rule.memo
      ))), 1, rule.income_kind
    );
  end loop;
end;
$$;

revoke all on function public.materialize_finance_month(date) from public;
grant execute on function public.materialize_finance_month(date) to authenticated;

create or replace function public.delete_installment_occurrences(
  p_rule_id uuid,
  p_installment_number int,
  p_scope text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_rule public.recurring_rules%rowtype;
  first_deleted_occurrence int;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if p_scope not in ('single', 'future', 'current_and_future', 'all') then
    raise exception '올바르지 않은 할부 삭제 범위입니다.';
  end if;

  select * into target_rule
  from public.recurring_rules
  where id = p_rule_id and rule_type = 'installment'
  for update;

  if target_rule.id is null then
    raise exception '삭제할 할부 거래를 찾을 수 없습니다.';
  end if;
  if not public.has_ledger_role(
    target_rule.ledger_id,
    array['owner', 'admin', 'member']
  ) then
    raise exception '할부 거래를 삭제할 권한이 없습니다.';
  end if;
  if p_installment_number not between 1 and target_rule.installment_months then
    raise exception '올바르지 않은 할부 회차입니다.';
  end if;

  first_deleted_occurrence := case p_scope
    when 'all' then 1
    when 'future' then p_installment_number + 1
    else p_installment_number
  end;

  update public.transactions
  set deleted_at = now(), updated_by = auth.uid(), updated_at = now()
  where recurring_rule_id = p_rule_id
    and deleted_at is null
    and (
      (p_scope = 'single' and installment_number = p_installment_number)
      or (p_scope = 'future' and installment_number > p_installment_number)
      or (
        p_scope = 'current_and_future'
        and installment_number >= p_installment_number
      )
      or p_scope = 'all'
    );

  if p_scope <> 'single'
    and first_deleted_occurrence <= target_rule.installment_months then
    update public.recurring_rules
    set
      inactive_from_month = (
        target_rule.start_month
        + make_interval(months => first_deleted_occurrence - 1)
      )::date,
      is_active = false,
      updated_at = now()
    where id = p_rule_id;
  end if;
end;
$$;

revoke all on function public.delete_installment_occurrences(
  uuid,
  int,
  text
) from public;
grant execute on function public.delete_installment_occurrences(
  uuid,
  int,
  text
) to authenticated;
