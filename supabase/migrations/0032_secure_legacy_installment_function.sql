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
  occurrence_index int;
  occurrence_at timestamptz;
  existing_transaction_id uuid;
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
  if p_type not in ('expense', 'income', 'saving') then
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
      (date_trunc('month', local_start)
        + make_interval(months => p_installment_months - 1))::date,
      p_installment_months, p_category_id, p_merchant_name, p_memo,
      p_type, p_status, p_actor_user_id, true
    ) returning id, created_by into installment_rule_id, rule_owner;
  else
    select id, created_by into installment_rule_id, rule_owner
    from public.recurring_rules
    where id = p_rule_id and ledger_id = p_ledger_id
      and rule_type = 'installment';
    if installment_rule_id is null then
      raise exception '할부 규칙을 찾을 수 없습니다.';
    end if;

    update public.recurring_rules
    set amount = p_amount,
        day_of_month = extract(day from local_start)::int,
        time_of_day = local_start::time,
        start_month = date_trunc('month', local_start)::date,
        end_month = (date_trunc('month', local_start)
          + make_interval(months => p_installment_months - 1))::date,
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

  for occurrence_index in 1..p_installment_months loop
    occurrence_at := p_transaction_at
      + make_interval(months => occurrence_index - 1);
    select id into existing_transaction_id
    from public.transactions
    where recurring_rule_id = installment_rule_id
      and installment_number = occurrence_index
      and deleted_at is null
    limit 1;

    if existing_transaction_id is null then
      insert into public.transactions (
        ledger_id, created_by, updated_by, actor_user_id, type, status,
        amount, currency, transaction_at, category_id, merchant_name, memo,
        source_type, recurring_rule_id, recurring_type, installment_number,
        installment_total
      ) values (
        p_ledger_id, rule_owner, auth.uid(), p_actor_user_id, p_type,
        p_status, p_amount, 'KRW', occurrence_at, p_category_id,
        p_merchant_name, p_memo, 'manual', installment_rule_id,
        'installment', occurrence_index, p_installment_months
      );
    else
      update public.transactions
      set updated_by = auth.uid(), actor_user_id = p_actor_user_id,
          type = p_type, status = p_status, amount = p_amount,
          transaction_at = occurrence_at, category_id = p_category_id,
          merchant_name = p_merchant_name, memo = p_memo,
          installment_total = p_installment_months, updated_at = now()
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

revoke all on function public.save_installment_series(
  uuid, uuid, numeric, timestamptz, int, uuid, text, text, uuid, text, text
) from public;
grant execute on function public.save_installment_series(
  uuid, uuid, numeric, timestamptz, int, uuid, text, text, uuid, text, text
) to authenticated;
