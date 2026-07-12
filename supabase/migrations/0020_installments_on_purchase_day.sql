-- Existing installments should appear on the purchase day in each month,
-- independently of the card's billing cycle.
update public.recurring_rules
set
  day_of_month = extract(day from timezone('Asia/Seoul', purchase_at))::int,
  time_of_day = timezone('Asia/Seoul', purchase_at)::time,
  start_month = date_trunc('month', timezone('Asia/Seoul', purchase_at))::date,
  end_month = (
    date_trunc('month', timezone('Asia/Seoul', purchase_at))
    + make_interval(months => installment_months - 1)
  )::date,
  updated_at = now()
where rule_type = 'installment'
  and purchase_at is not null
  and installment_months is not null;

update public.transactions txn
set
  transaction_at = rule.purchase_at
    + make_interval(months => txn.installment_number - 1),
  updated_at = now()
from public.recurring_rules rule
where txn.recurring_rule_id = rule.id
  and rule.rule_type = 'installment'
  and rule.purchase_at is not null
  and txn.installment_number is not null
  and txn.deleted_at is null;

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
declare
  saved_rule_id uuid;
begin
  saved_rule_id := public.save_card_installment_series_v2(
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

  update public.recurring_rules
  set
    day_of_month = extract(day from timezone('Asia/Seoul', p_transaction_at))::int,
    time_of_day = timezone('Asia/Seoul', p_transaction_at)::time,
    start_month = date_trunc('month', timezone('Asia/Seoul', p_transaction_at))::date,
    end_month = (
      date_trunc('month', timezone('Asia/Seoul', p_transaction_at))
      + make_interval(months => p_installment_months - 1)
    )::date,
    updated_at = now()
  where id = saved_rule_id;

  update public.transactions txn
  set
    transaction_at = p_transaction_at
      + make_interval(months => txn.installment_number - 1),
    updated_at = now()
  where txn.recurring_rule_id = saved_rule_id
    and txn.installment_number is not null
    and txn.deleted_at is null;

  return saved_rule_id;
end;
$$;

revoke all on function public.save_purchase_day_installment_series(
  uuid, uuid, numeric, text, timestamptz, int, uuid, text, text, uuid,
  text, text, uuid
) from public;
grant execute on function public.save_purchase_day_installment_series(
  uuid, uuid, numeric, text, timestamptz, int, uuid, text, text, uuid,
  text, text, uuid
) to authenticated;
