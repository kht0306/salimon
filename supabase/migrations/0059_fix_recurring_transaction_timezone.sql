-- Recurring rule dates and times represent Asia/Seoul wall-clock values.
-- Convert them to an explicit instant before encrypting the transaction payload.

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
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;

  for rule in
    select * from public.recurring_rules recurring_rule
    where public.is_ledger_member(recurring_rule.ledger_id)
      and recurring_rule.start_month <= month_start
      and (recurring_rule.end_month is null or recurring_rule.end_month >= month_start)
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
        'transaction_at',
          (occurrence_date + rule.time_of_day) at time zone 'Asia/Seoul',
        'merchant_name', rule.merchant_name,
        'memo', rule.memo
      ))), 1, rule.income_kind
    );
  end loop;
end;
$$;

revoke all on function public.materialize_finance_month(date) from public;
grant execute on function public.materialize_finance_month(date) to authenticated;

-- Rebuild every existing recurring occurrence from its rule so both previously
-- shifted transactions and already-correct transactions use one canonical instant.
with recurring_occurrences as (
  select
    transaction.id,
    private.decrypt_payload(transaction.private_payload) as payload,
    (
      rule.start_month
      + make_interval(months => transaction.installment_number - 1)
    )::date as occurrence_month,
    rule.day_of_month,
    rule.time_of_day
  from public.encrypted_transactions transaction
  join public.recurring_rules rule
    on rule.id = transaction.recurring_rule_id
  where transaction.installment_number >= 1
),
corrected_occurrences as (
  select
    occurrence.id,
    occurrence.payload,
    (
      make_date(
        extract(year from occurrence.occurrence_month)::int,
        extract(month from occurrence.occurrence_month)::int,
        least(
          occurrence.day_of_month,
          extract(
            day from (
              occurrence.occurrence_month + interval '1 month - 1 day'
            )
          )::int
        )
      ) + occurrence.time_of_day
    ) at time zone 'Asia/Seoul' as transaction_at
  from recurring_occurrences occurrence
)
update public.encrypted_transactions transaction
set
  private_payload = private.encrypt_payload(
    occurrence.payload
    || jsonb_build_object('transaction_at', occurrence.transaction_at)
  ),
  encryption_key_version = 1
from corrected_occurrences occurrence
where transaction.id = occurrence.id;
