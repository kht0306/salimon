create or replace function public.update_transaction_with_recurrence(
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
  p_installment_amount_type text
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
  new_rule_id uuid;
  local_transaction timestamp := timezone('Asia/Seoul', p_transaction_at);
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

  if target_recurring_type is not null
    and target_recurring_type not in ('fixed', 'installment') then
    raise exception '올바르지 않은 반복 유형입니다.';
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

    return public.save_card_installment_series_v2(
      original.recurring_rule_id,
      p_ledger_id,
      p_amount,
      coalesce(p_installment_amount_type, 'monthly'),
      p_transaction_at,
      coalesce(p_installment_months, original.installment_total, 2),
      p_category_id,
      p_merchant_name,
      p_memo,
      p_actor_user_id,
      p_status,
      p_type,
      original.payment_method_id
    );
  end if;

  cutoff_month := date_trunc(
    'month',
    timezone('Asia/Seoul', original.transaction_at)
  )::date;

  if original.recurring_type = 'fixed'
    and original.recurring_rule_id is not null
    and target_recurring_type is distinct from 'fixed' then
    update public.recurring_rules
    set
      inactive_from_month = cutoff_month,
      is_active = false,
      updated_at = now()
    where id = original.recurring_rule_id
      and ledger_id = p_ledger_id
      and rule_type = 'fixed';

    update public.transactions
    set
      deleted_at = now(),
      updated_by = auth.uid(),
      updated_at = now()
    where recurring_rule_id = original.recurring_rule_id
      and deleted_at is null
      and timezone('Asia/Seoul', transaction_at)::date >= cutoff_month
      and (
        target_recurring_type = 'installment'
        or id <> original.id
      );
  end if;

  if target_recurring_type = 'installment' then
    if p_type <> 'expense' then
      raise exception '할부는 지출 거래에만 설정할 수 있습니다.';
    end if;

    update public.transactions
    set
      deleted_at = now(),
      updated_by = auth.uid(),
      updated_at = now()
    where id = original.id
      and deleted_at is null;

    return public.save_card_installment_series_v2(
      null,
      p_ledger_id,
      p_amount,
      coalesce(p_installment_amount_type, 'monthly'),
      p_transaction_at,
      coalesce(p_installment_months, 2),
      p_category_id,
      p_merchant_name,
      p_memo,
      p_actor_user_id,
      p_status,
      p_type,
      p_payment_method_id
    );
  end if;

  if target_recurring_type = 'fixed'
    and original.recurring_type is distinct from 'fixed' then
    insert into public.recurring_rules (
      ledger_id,
      created_by,
      rule_type,
      amount,
      day_of_month,
      time_of_day,
      start_month,
      end_month,
      installment_months,
      category_id,
      payment_method_id,
      merchant_name,
      memo,
      transaction_type,
      transaction_status,
      actor_user_id,
      is_active
    ) values (
      p_ledger_id,
      auth.uid(),
      'fixed',
      p_amount,
      extract(day from local_transaction)::int,
      local_transaction::time,
      date_trunc('month', local_transaction)::date,
      null,
      null,
      p_category_id,
      p_payment_method_id,
      p_merchant_name,
      p_memo,
      p_type,
      p_status,
      p_actor_user_id,
      true
    )
    returning id into new_rule_id;

    update public.transactions
    set
      updated_by = auth.uid(),
      actor_user_id = p_actor_user_id,
      type = p_type,
      status = p_status,
      amount = p_amount,
      transaction_at = p_transaction_at,
      category_id = p_category_id,
      payment_method_id = p_payment_method_id,
      merchant_name = p_merchant_name,
      memo = p_memo,
      recurring_rule_id = new_rule_id,
      recurring_type = 'fixed',
      installment_number = 1,
      installment_total = null,
      updated_at = now()
    where id = original.id;

    return new_rule_id;
  end if;

  update public.transactions
  set
    updated_by = auth.uid(),
    actor_user_id = p_actor_user_id,
    type = p_type,
    status = p_status,
    amount = p_amount,
    transaction_at = p_transaction_at,
    category_id = p_category_id,
    payment_method_id = p_payment_method_id,
    merchant_name = p_merchant_name,
    memo = p_memo,
    recurring_rule_id = case
      when target_recurring_type = 'fixed' then original.recurring_rule_id
      else null
    end,
    recurring_type = target_recurring_type,
    installment_number = case
      when target_recurring_type = 'fixed' then original.installment_number
      else null
    end,
    installment_total = null,
    updated_at = now()
  where id = original.id;

  return case
    when target_recurring_type = 'fixed' then original.recurring_rule_id
    else null
  end;
end;
$$;

revoke all on function public.update_transaction_with_recurrence(
  uuid, uuid, numeric, timestamptz, uuid, text, text, uuid, text, text, uuid,
  text, int, text
) from public;
grant execute on function public.update_transaction_with_recurrence(
  uuid, uuid, numeric, timestamptz, uuid, text, text, uuid, text, text, uuid,
  text, int, text
) to authenticated;
