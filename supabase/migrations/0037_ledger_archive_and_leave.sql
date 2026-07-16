alter table public.encrypted_ledgers
  add column archived_at timestamptz,
  add column purge_after timestamptz;

create or replace view public.ledgers
with (security_invoker = true)
as
select
  ledger.id,
  ledger.owner_id,
  data.payload ->> 'name' as name,
  ledger.type,
  ledger.currency,
  ledger.created_at,
  ledger.updated_at,
  ledger.archived_at,
  ledger.purge_after
from public.encrypted_ledgers ledger
cross join lateral (
  select private.decrypt_payload(ledger.private_payload) as payload
) data;

create or replace function public.archive_ledger(p_ledger_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  replacement_ledger_id uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (
    select 1 from public.encrypted_ledgers
    where id = p_ledger_id and owner_id = auth.uid() and archived_at is null
  ) then
    raise exception '소유한 가계부만 보관할 수 있습니다.';
  end if;

  update public.encrypted_ledgers
  set archived_at = now(), purge_after = now() + interval '30 days',
      updated_at = now()
  where id = p_ledger_id;
  update public.encrypted_ledger_members set is_default = false
  where ledger_id = p_ledger_id and user_id = auth.uid() and is_default;

  select member.ledger_id into replacement_ledger_id
  from public.encrypted_ledger_members member
  join public.encrypted_ledgers ledger on ledger.id = member.ledger_id
  where member.user_id = auth.uid() and member.status = 'active'
    and ledger.archived_at is null
  order by member.joined_at, member.id
  limit 1;
  if replacement_ledger_id is not null and not exists (
    select 1 from public.encrypted_ledger_members
    where user_id = auth.uid() and status = 'active' and is_default
  ) then
    update public.encrypted_ledger_members set is_default = true
    where ledger_id = replacement_ledger_id and user_id = auth.uid();
  end if;
end;
$$;
revoke all on function public.archive_ledger(uuid) from public;
grant execute on function public.archive_ledger(uuid) to authenticated;

create or replace function public.restore_ledger(p_ledger_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (
    select 1 from public.encrypted_ledgers
    where id = p_ledger_id and owner_id = auth.uid() and archived_at is not null
  ) then
    raise exception '복구할 수 있는 가계부를 찾지 못했습니다.';
  end if;
  update public.encrypted_ledgers
  set archived_at = null, purge_after = null, updated_at = now()
  where id = p_ledger_id;
end;
$$;
revoke all on function public.restore_ledger(uuid) from public;
grant execute on function public.restore_ledger(uuid) to authenticated;

create or replace function public.leave_shared_ledger(p_ledger_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (
    select 1
    from public.encrypted_ledger_members member
    join public.encrypted_ledgers ledger on ledger.id = member.ledger_id
    where member.ledger_id = p_ledger_id and member.user_id = auth.uid()
      and member.status = 'active' and member.role <> 'owner'
      and ledger.type = 'shared'
  ) then
    raise exception '참여 중인 공동 가계부에서만 나갈 수 있습니다.';
  end if;
  update public.encrypted_ledger_payment_methods
  set visibility = 'private', is_active = false, is_primary = false,
      updated_at = now()
  where ledger_id = p_ledger_id and owner_user_id = auth.uid();
  update public.encrypted_ledger_members
  set status = 'removed', removed_at = now(), is_default = false
  where ledger_id = p_ledger_id and user_id = auth.uid();
end;
$$;
revoke all on function public.leave_shared_ledger(uuid) from public;
grant execute on function public.leave_shared_ledger(uuid) to authenticated;
