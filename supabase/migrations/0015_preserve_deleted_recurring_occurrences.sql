-- A deleted recurring occurrence is a tombstone. Remove any occurrence that was
-- recreated under a new id before this behavior was fixed.
update public.transactions as active_transaction
set
  deleted_at = now(),
  updated_at = now()
where active_transaction.deleted_at is null
  and active_transaction.recurring_rule_id is not null
  and exists (
    select 1
    from public.transactions as deleted_transaction
    where deleted_transaction.recurring_rule_id = active_transaction.recurring_rule_id
      and deleted_transaction.installment_number is not distinct from active_transaction.installment_number
      and deleted_transaction.deleted_at is not null
  );

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

    -- Include deleted rows in this check. Their presence records that the user
    -- intentionally removed this one occurrence and prevents regeneration.
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

    insert into public.transactions (
      ledger_id, created_by, updated_by, actor_user_id, type, status, amount,
      currency, transaction_at, category_id, merchant_name, memo, source_type,
      recurring_rule_id, recurring_type, installment_number, installment_total
    ) values (
      rule.ledger_id, rule.created_by, rule.created_by, rule.actor_user_id,
      rule.transaction_type, rule.transaction_status, rule.amount, 'KRW',
      occurrence_date + rule.time_of_day, rule.category_id, rule.merchant_name,
      rule.memo, 'manual', rule.id, rule.rule_type, occurrence_no,
      case
        when rule.rule_type = 'installment' then rule.installment_months
        else null
      end
    )
    on conflict (recurring_rule_id, installment_number)
      where recurring_rule_id is not null and deleted_at is null
    do nothing;
  end loop;
end;
$$;

grant execute on function public.materialize_finance_month(date) to authenticated;
