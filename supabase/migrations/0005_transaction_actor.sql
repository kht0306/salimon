alter table public.transactions
add column if not exists actor_user_id uuid references auth.users(id) on delete set null;

update public.transactions
set actor_user_id = created_by
where actor_user_id is null;

create index if not exists transactions_actor_date_idx
on public.transactions (actor_user_id, transaction_at desc)
where deleted_at is null;
