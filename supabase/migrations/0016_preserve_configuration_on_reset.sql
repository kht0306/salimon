create or replace function public.reset_my_finance_data()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  -- Clear transactional test data while preserving ledgers, members,
  -- categories, category budgets, and payment methods.
  delete from public.transactions
  where ledger_id in (
    select id from public.ledgers where owner_id = auth.uid()
  );

  delete from public.recurring_rules
  where ledger_id in (
    select id from public.ledgers where owner_id = auth.uid()
  );

  delete from public.card_message_samples
  where submitted_by = auth.uid();

  delete from public.notification_rules
  where user_id = auth.uid();
end;
$$;

revoke all on function public.reset_my_finance_data() from public;
grant execute on function public.reset_my_finance_data() to authenticated;
