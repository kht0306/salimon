create or replace function public.update_transaction_with_recurrence_v2(
  p_transaction_id uuid,
  p_ledger_id uuid,
  p_amount numeric,
  p_transaction_at timestamptz,
  p_category_id uuid,
  p_merchant_name text,
  p_memo text,
  p_actor_user_id uuid,
  p_status text,
  p_type text,
  p_payment_method_id uuid,
  p_recurring_type text,
  p_installment_months int,
  p_installment_amount_type text,
  p_apply_amount_to_future boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  original public.transactions%rowtype;
  target_recurring_type text := nullif(p_recurring_type, 'none');
  cutoff_month date;
  actual_installment_principal numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_amount <= 0 then
    raise exception '금액은 0보다 커야 합니다.';
  end if;

  if p_status not in ('pending', 'confirmed', 'excluded') then
    raise exception '올바르지 않은 거래 상태입니다.';
  end if;

  if p_type not in ('expense', 'income', 'saving') then
    raise exception '올바르지 않은 거래 유형입니다.';
  end if;

  select *
  into original
  from public.transactions
  where id = p_transaction_id
    and ledger_id = p_ledger_id
    and deleted_at is null
  for update;

  if original.id is null then
    raise exception '수정할 거래를 찾을 수 없습니다.';
  end if;

  if not public.has_ledger_role(
    p_ledger_id,
    array['owner', 'admin', 'member']
  ) then
    raise exception '거래를 수정할 권한이 없습니다.';
  end if;

  cutoff_month := date_trunc(
    'month',
    timezone('Asia/Seoul', original.transaction_at)
  )::date;

  if original.recurring_type = 'installment' then
    if target_recurring_type is distinct from 'installment' then
      raise exception '할부 거래는 반복 유형을 변경할 수 없습니다.';
    end if;

    if p_payment_method_id is distinct from original.payment_method_id then
      raise exception '할부 거래는 결제 수단을 변경할 수 없습니다.';
    end if;

    if p_type is distinct from original.type then
      raise exception '할부 거래는 거래 유형을 변경할 수 없습니다.';
    end if;

    update public.transactions
    set
      updated_by = auth.uid(),
      actor_user_id = p_actor_user_id,
      type = p_type,
      status = p_status,
      amount = case
        when id = original.id then p_amount
        when coalesce(p_apply_amount_to_future, true)
          and timezone('Asia/Seoul', transaction_at)::date >= cutoff_month
          then p_amount
        else amount
      end,
      category_id = p_category_id,
      merchant_name = p_merchant_name,
      memo = p_memo,
      updated_at = now()
    where recurring_rule_id = original.recurring_rule_id
      and deleted_at is null;

    select coalesce(sum(amount), 0)
    into actual_installment_principal
    from public.transactions
    where recurring_rule_id = original.recurring_rule_id
      and deleted_at is null;

    update public.recurring_rules
    set
      amount = case
        when coalesce(p_apply_amount_to_future, true) then p_amount
        else amount
      end,
      installment_principal = case
        when coalesce(p_apply_amount_to_future, true)
          then actual_installment_principal
        else installment_principal
      end,
      category_id = p_category_id,
      merchant_name = p_merchant_name,
      memo = p_memo,
      transaction_status = p_status,
      actor_user_id = p_actor_user_id,
      updated_at = now()
    where id = original.recurring_rule_id
      and ledger_id = p_ledger_id
      and rule_type = 'installment';

    return original.recurring_rule_id;
  end if;

  if original.recurring_type = 'fixed'
    and target_recurring_type = 'fixed'
    and coalesce(p_apply_amount_to_future, true) then
    update public.recurring_rules
    set amount = p_amount, updated_at = now()
    where id = original.recurring_rule_id
      and ledger_id = p_ledger_id
      and rule_type = 'fixed';

    update public.transactions
    set amount = p_amount, updated_by = auth.uid(), updated_at = now()
    where recurring_rule_id = original.recurring_rule_id
      and deleted_at is null
      and timezone('Asia/Seoul', transaction_at)::date >= cutoff_month;
  end if;

  return public.update_transaction_with_recurrence(
    p_transaction_id,
    p_ledger_id,
    p_amount,
    p_transaction_at,
    p_category_id,
    p_merchant_name,
    p_memo,
    p_actor_user_id,
    p_status,
    p_type,
    p_payment_method_id,
    p_recurring_type,
    p_installment_months,
    p_installment_amount_type
  );
end;
$$;

revoke all on function public.update_transaction_with_recurrence_v2(
  uuid, uuid, numeric, timestamptz, uuid, text, text, uuid, text, text, uuid,
  text, int, text, boolean
) from public;
grant execute on function public.update_transaction_with_recurrence_v2(
  uuid, uuid, numeric, timestamptz, uuid, text, text, uuid, text, text, uuid,
  text, int, text, boolean
) to authenticated;
