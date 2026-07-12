alter table public.payment_methods
  add column if not exists payment_day int check (payment_day between 1 and 31),
  add column if not exists billing_period_end_day int check (billing_period_end_day between 1 and 31),
  add column if not exists billing_period_end_month_offset int
    check (billing_period_end_month_offset in (-1, 0));

alter table public.recurring_rules
  add column if not exists purchase_at timestamptz,
  add column if not exists payment_method_id uuid
    references public.payment_methods(id) on delete set null;

create or replace function public.save_card_installment_series(
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
  local_purchase timestamp := timezone('Asia/Seoul', p_transaction_at);
  payment_month date := date_trunc('month', local_purchase)::date;
  cutoff_month date;
  cutoff_date date;
  first_payment_local timestamp;
  first_payment_at timestamptz;
  saved_rule_id uuid;
begin
  select * into card
  from public.payment_methods
  where id = p_payment_method_id
    and ledger_id = p_ledger_id
    and type = 'card'
    and is_active;

  if card.id is null or card.payment_day is null
    or card.billing_period_end_day is null
    or card.billing_period_end_month_offset is null then
    raise exception '청구주기가 등록된 카드를 선택해 주세요.';
  end if;

  cutoff_month := (payment_month + make_interval(months => card.billing_period_end_month_offset))::date;
  cutoff_date := make_date(
    extract(year from cutoff_month)::int,
    extract(month from cutoff_month)::int,
    least(card.billing_period_end_day, extract(day from (date_trunc('month', cutoff_month) + interval '1 month - 1 day'))::int)
  );
  if local_purchase::date > cutoff_date then
    payment_month := (payment_month + interval '1 month')::date;
  end if;

  first_payment_local := make_date(
    extract(year from payment_month)::int,
    extract(month from payment_month)::int,
    least(card.payment_day, extract(day from (date_trunc('month', payment_month) + interval '1 month - 1 day'))::int)
  ) + local_purchase::time;
  first_payment_at := first_payment_local at time zone 'Asia/Seoul';

  saved_rule_id := public.save_installment_series(
    p_rule_id, p_ledger_id, p_amount, first_payment_at, p_installment_months,
    p_category_id, p_merchant_name, p_memo, p_actor_user_id, p_status, p_type
  );

  update public.recurring_rules
  set purchase_at = p_transaction_at,
      payment_method_id = p_payment_method_id,
      updated_at = now()
  where id = saved_rule_id;

  update public.transactions
  set payment_method_id = p_payment_method_id,
      updated_at = now()
  where recurring_rule_id = saved_rule_id and deleted_at is null;

  return saved_rule_id;
end;
$$;

revoke all on function public.save_card_installment_series(uuid, uuid, numeric, timestamptz, int, uuid, text, text, uuid, text, text, uuid) from public;
grant execute on function public.save_card_installment_series(uuid, uuid, numeric, timestamptz, int, uuid, text, text, uuid, text, text, uuid) to authenticated;

create or replace function public.reset_my_finance_data()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;

  delete from public.card_message_samples where submitted_by = auth.uid();
  delete from public.notification_rules where user_id = auth.uid();
  delete from public.ledgers where owner_id = auth.uid();
end;
$$;

revoke all on function public.reset_my_finance_data() from public;
grant execute on function public.reset_my_finance_data() to authenticated;
