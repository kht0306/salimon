-- Account deletion has a 7-day recovery window. Shared-ledger history remains
-- intact after a member leaves, while personal ledgers owned by the account
-- are removed with the auth user.

alter table public.encrypted_transactions
  alter column created_by drop not null;
alter table public.encrypted_transactions
  drop constraint if exists transactions_created_by_fkey;
alter table public.encrypted_transactions
  drop constraint if exists encrypted_transactions_created_by_fkey;
alter table public.encrypted_transactions
  add constraint encrypted_transactions_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.encrypted_recurring_rules
  alter column created_by drop not null;
alter table public.encrypted_recurring_rules
  drop constraint if exists recurring_rules_created_by_fkey;
alter table public.encrypted_recurring_rules
  drop constraint if exists encrypted_recurring_rules_created_by_fkey;
alter table public.encrypted_recurring_rules
  add constraint encrypted_recurring_rules_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.encrypted_user_payment_methods
  alter column owner_user_id drop not null;
alter table public.encrypted_user_payment_methods
  drop constraint if exists encrypted_user_payment_methods_owner_user_id_fkey;
alter table public.encrypted_user_payment_methods
  add constraint encrypted_user_payment_methods_owner_user_id_fkey
  foreign key (owner_user_id) references auth.users(id) on delete set null;

create table public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  purge_after timestamptz not null default now() + interval '7 days'
);

alter table public.account_deletion_requests enable row level security;

create policy "account_deletion_requests_select_own"
on public.account_deletion_requests for select to authenticated
using (user_id = auth.uid());

revoke insert, update, delete on public.account_deletion_requests
from anon, authenticated;
grant select on public.account_deletion_requests to authenticated;

create or replace function public.request_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  scheduled_at timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;

  if exists (
    select 1
    from public.encrypted_ledgers ledger
    join public.encrypted_ledger_members member
      on member.ledger_id = ledger.id
    where ledger.owner_id = auth.uid()
      and ledger.type = 'shared'
      and ledger.archived_at is null
      and member.user_id <> auth.uid()
      and member.status = 'active'
  ) then
    raise exception '다른 멤버가 있는 공동 가계부의 소유권을 먼저 이전해 주세요.';
  end if;

  insert into public.account_deletion_requests (
    user_id, requested_at, purge_after
  ) values (
    auth.uid(), now(), scheduled_at
  )
  on conflict (user_id) do update
  set requested_at = excluded.requested_at,
      purge_after = excluded.purge_after;

  return scheduled_at;
end;
$$;

revoke all on function public.request_account_deletion() from public;
grant execute on function public.request_account_deletion() to authenticated;

create or replace function public.cancel_account_deletion()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  delete from public.account_deletion_requests where user_id = auth.uid();
end;
$$;

revoke all on function public.cancel_account_deletion() from public;
grant execute on function public.cancel_account_deletion() to authenticated;

create or replace function private.purge_expired_accounts()
returns bigint
language plpgsql
security definer
set search_path = public, private, auth, pg_catalog
as $$
declare
  purged_count bigint;
  target record;
begin
  purged_count := 0;
  for target in
    select request.user_id
    from public.account_deletion_requests request
    where request.purge_after <= now()
    for update skip locked
  loop
    update public.encrypted_recurring_rules
    set is_active = false, updated_at = now()
    where created_by = target.user_id and is_active;

    update public.encrypted_ledger_payment_methods
    set visibility = 'private', is_active = false, is_primary = false,
        updated_at = now()
    where owner_user_id = target.user_id;

    delete from auth.users where id = target.user_id;
    if found then purged_count := purged_count + 1; end if;
  end loop;
  return purged_count;
end;
$$;

revoke all on function private.purge_expired_accounts() from public;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'salimon-purge-expired-accounts'
  ) then
    perform cron.schedule(
      'salimon-purge-expired-accounts',
      '17 3 * * *',
      'select private.purge_expired_accounts()'
    );
  end if;
end;
$$;
