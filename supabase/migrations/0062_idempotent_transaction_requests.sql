-- Reuse client-generated UUIDs as durable write request identifiers. Regular
-- transactions and fixed rules already accept explicit primary keys through
-- their writable views. This wrapper gives new installment rules the same
-- retry behavior while preserving the v3 edit contract.

create or replace function public.save_card_installment_series_v4(
  p_rule_id uuid,
  p_request_id uuid,
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
set search_path = public, auth, pg_catalog
as $$
declare
  effective_rule_id uuid := p_rule_id;
  request_rule record;
  local_purchase timestamp := timezone('Asia/Seoul', p_transaction_at);
  purchase_month date := date_trunc('month', local_purchase)::date;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not public.has_ledger_role(
    p_ledger_id,
    array['owner', 'admin', 'member']
  ) then
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

  if p_rule_id is null and p_request_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(p_request_id::text, 0)
    );

    select id, ledger_id, created_by, rule_type
    into request_rule
    from public.recurring_rules
    where id = p_request_id;

    if request_rule.id is not null then
      if request_rule.ledger_id <> p_ledger_id
        or request_rule.created_by <> auth.uid()
        or request_rule.rule_type <> 'installment' then
        raise exception '동일한 저장 요청 ID를 사용할 수 없습니다.';
      end if;
      effective_rule_id := request_rule.id;
    else
      insert into public.recurring_rules (
        id, ledger_id, created_by, rule_type, amount, day_of_month,
        time_of_day, start_month, end_month, installment_months,
        installment_amount_type, installment_principal, purchase_at,
        payment_method_id, category_id, merchant_name, memo,
        transaction_type, transaction_status, actor_user_id, is_active
      ) values (
        p_request_id, p_ledger_id, auth.uid(), 'installment', p_amount, 1,
        local_purchase::time, purchase_month,
        (
          purchase_month
          + make_interval(months => p_installment_months - 1)
        )::date,
        p_installment_months, p_amount_type,
        case
          when p_amount_type = 'principal' then p_amount
          else p_amount * p_installment_months
        end,
        p_transaction_at, p_payment_method_id, p_category_id,
        p_merchant_name, p_memo, p_type, p_status, p_actor_user_id, true
      );

      update public.encrypted_recurring_rules
      set installment_schedule_type = 'purchase_then_payment_day'
      where id = p_request_id;
      effective_rule_id := p_request_id;
    end if;
  end if;

  return public.save_card_installment_series_v3(
    effective_rule_id,
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

revoke all on function public.save_card_installment_series_v4(
  uuid, uuid, uuid, numeric, text, timestamptz, int, uuid, text, text,
  uuid, text, text, uuid
) from public;
grant execute on function public.save_card_installment_series_v4(
  uuid, uuid, uuid, numeric, text, timestamptz, int, uuid, text, text,
  uuid, text, text, uuid
) to authenticated;
