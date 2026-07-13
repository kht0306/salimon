-- Installments are charged on the card payment day determined by its billing
-- cycle. Migration 0020 temporarily moved them to the original purchase day;
-- restore both existing data and the compatibility RPC used by older clients.

with schedule_source as (
  select
    rule.id,
    rule.installment_months,
    timezone('Asia/Seoul', rule.purchase_at) as local_purchase,
    method.payment_day,
    method.billing_period_end_day,
    method.billing_period_end_month_offset,
    date_trunc('month', timezone('Asia/Seoul', rule.purchase_at))::date as purchase_month
  from public.recurring_rules rule
  join public.payment_methods method
    on method.id = rule.payment_method_id
   and method.ledger_id = rule.ledger_id
  where rule.rule_type = 'installment'
    and rule.purchase_at is not null
    and rule.installment_months is not null
    and method.type = 'card'
    and method.payment_day is not null
    and method.billing_period_end_day is not null
    and method.billing_period_end_month_offset is not null
), cutoff_schedule as (
  select
    source.*,
    make_date(
      extract(year from cutoff_month)::int,
      extract(month from cutoff_month)::int,
      least(
        source.billing_period_end_day,
        extract(day from (date_trunc('month', cutoff_month) + interval '1 month - 1 day'))::int
      )
    ) as cutoff_date
  from schedule_source source
  cross join lateral (
    select (
      source.purchase_month
      + make_interval(months => source.billing_period_end_month_offset)
    )::date as cutoff_month
  ) cutoff
), payment_schedule as (
  select
    cutoff.*,
    case
      when cutoff.local_purchase::date > cutoff.cutoff_date
        then (cutoff.purchase_month + interval '1 month')::date
      else cutoff.purchase_month
    end as payment_month
  from cutoff_schedule cutoff
), first_payments as (
  select
    payment.*,
    make_date(
      extract(year from payment.payment_month)::int,
      extract(month from payment.payment_month)::int,
      least(
        payment.payment_day,
        extract(day from (date_trunc('month', payment.payment_month) + interval '1 month - 1 day'))::int
      )
    ) + payment.local_purchase::time as first_payment_local
  from payment_schedule payment
)
update public.recurring_rules rule
set
  day_of_month = extract(day from first.first_payment_local)::int,
  time_of_day = first.first_payment_local::time,
  start_month = date_trunc('month', first.first_payment_local)::date,
  end_month = (
    date_trunc('month', first.first_payment_local)
    + make_interval(months => first.installment_months - 1)
  )::date,
  updated_at = now()
from first_payments first
where rule.id = first.id;

with occurrence_schedule as (
  select
    txn.id,
    rule.day_of_month,
    rule.time_of_day,
    (
      rule.start_month
      + make_interval(months => txn.installment_number - 1)
    )::date as occurrence_month
  from public.transactions txn
  join public.recurring_rules rule on rule.id = txn.recurring_rule_id
  where rule.rule_type = 'installment'
    and txn.installment_number is not null
    and txn.deleted_at is null
), occurrence_dates as (
  select
    occurrence.id,
    make_date(
      extract(year from occurrence.occurrence_month)::int,
      extract(month from occurrence.occurrence_month)::int,
      least(
        occurrence.day_of_month,
        extract(day from (date_trunc('month', occurrence.occurrence_month) + interval '1 month - 1 day'))::int
      )
    ) + occurrence.time_of_day as occurrence_local
  from occurrence_schedule occurrence
)
update public.transactions txn
set
  transaction_at = occurrence.occurrence_local at time zone 'Asia/Seoul',
  updated_at = now()
from occurrence_dates occurrence
where txn.id = occurrence.id;

create or replace function public.save_purchase_day_installment_series(
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
begin
  return public.save_card_installment_series_v2(
    p_rule_id,
    p_ledger_id,
    p_amount,
    p_amount_type,
    p_transaction_at,
    p_installment_months,
    p_category_id,
    p_merchant_name,
    p_memo,
    p_actor_user_id,
    p_status,
    p_type,
    p_payment_method_id
  );
end;
$$;
