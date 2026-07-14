-- Transfers are no longer modeled as a transaction type. Bank accounts are
-- payment methods for expense transactions only.
do $$
declare
  removed_transactions bigint;
  removed_recurring_rules bigint;
  removed_categories bigint;
  detached_transactions bigint;
  detached_recurring_rules bigint;
begin
  delete from public.transactions
  where type = 'transfer';
  get diagnostics removed_transactions = row_count;

  delete from public.recurring_rules
  where transaction_type = 'transfer';
  get diagnostics removed_recurring_rules = row_count;

  update public.transactions
  set category_id = null, updated_at = now()
  where category_id in (
    select id from public.categories where type = 'transfer'
  );
  get diagnostics detached_transactions = row_count;

  update public.recurring_rules
  set category_id = null, updated_at = now()
  where category_id in (
    select id from public.categories where type = 'transfer'
  );
  get diagnostics detached_recurring_rules = row_count;

  delete from public.categories
  where type = 'transfer';
  get diagnostics removed_categories = row_count;

  raise notice
    'transfer cleanup: transactions=%, recurring_rules=%, categories=%, detached_transactions=%, detached_recurring_rules=%',
    removed_transactions,
    removed_recurring_rules,
    removed_categories,
    detached_transactions,
    detached_recurring_rules;
end;
$$;

alter table public.categories
  drop constraint if exists categories_type_check;
alter table public.categories
  add constraint categories_type_check
  check (type in ('expense', 'income', 'saving'));

alter table public.transactions
  drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
  check (type in ('expense', 'income', 'saving'));

alter table public.recurring_rules
  drop constraint if exists recurring_rules_transaction_type_check;
alter table public.recurring_rules
  add constraint recurring_rules_transaction_type_check
  check (transaction_type in ('expense', 'income', 'saving'));
