-- Explicit shared-ledger administration with least-privilege role changes,
-- removal, ownership transfer, and an auditable member-event history.

create table public.ledger_member_events (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.encrypted_ledgers(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('role_changed', 'removed', 'ownership_transferred')),
  previous_role text,
  next_role text,
  created_at timestamptz not null default now()
);

alter table public.ledger_member_events enable row level security;

create policy "ledger_member_events_select_member"
on public.ledger_member_events for select to authenticated
using (public.is_ledger_member(ledger_id));

revoke insert, update, delete on public.ledger_member_events
from anon, authenticated;
grant select on public.ledger_member_events to authenticated;

create or replace function public.update_ledger_member_role(
  p_ledger_id uuid,
  p_target_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  previous_role text;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if p_role not in ('admin', 'member', 'viewer') then
    raise exception '변경할 수 없는 멤버 역할입니다.';
  end if;
  if not exists (
    select 1 from public.encrypted_ledgers
    where id = p_ledger_id and owner_id = auth.uid()
      and type = 'shared' and archived_at is null
  ) then
    raise exception '가계부 소유자만 멤버 역할을 변경할 수 있습니다.';
  end if;

  select role into previous_role
  from public.encrypted_ledger_members
  where ledger_id = p_ledger_id and user_id = p_target_user_id
    and status = 'active'
  for update;

  if previous_role is null or previous_role = 'owner' then
    raise exception '역할을 변경할 수 없는 멤버입니다.';
  end if;
  if previous_role = p_role then return; end if;

  update public.encrypted_ledger_members
  set role = p_role
  where ledger_id = p_ledger_id and user_id = p_target_user_id;

  insert into public.ledger_member_events (
    ledger_id, actor_user_id, target_user_id, action, previous_role, next_role
  ) values (
    p_ledger_id, auth.uid(), p_target_user_id, 'role_changed',
    previous_role, p_role
  );
end;
$$;

revoke all on function public.update_ledger_member_role(uuid, uuid, text)
from public;
grant execute on function public.update_ledger_member_role(uuid, uuid, text)
to authenticated;

create or replace function public.remove_ledger_member(
  p_ledger_id uuid,
  p_target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_role text;
  target_role text;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if p_target_user_id = auth.uid() then
    raise exception '본인은 공동 가계부 나가기를 이용해 주세요.';
  end if;

  select role into actor_role
  from public.encrypted_ledger_members
  where ledger_id = p_ledger_id and user_id = auth.uid()
    and status = 'active';
  select role into target_role
  from public.encrypted_ledger_members
  where ledger_id = p_ledger_id and user_id = p_target_user_id
    and status = 'active'
  for update;

  if actor_role not in ('owner', 'admin') then
    raise exception '멤버를 내보낼 권한이 없습니다.';
  end if;
  if target_role is null or target_role = 'owner' then
    raise exception '내보낼 수 없는 멤버입니다.';
  end if;
  if actor_role = 'admin' and target_role = 'admin' then
    raise exception '관리자는 다른 관리자를 내보낼 수 없습니다.';
  end if;

  update public.encrypted_ledger_payment_methods
  set visibility = 'private', is_active = false, is_primary = false,
      updated_at = now()
  where ledger_id = p_ledger_id and owner_user_id = p_target_user_id;

  update public.encrypted_ledger_members
  set status = 'removed', removed_at = now(), is_default = false
  where ledger_id = p_ledger_id and user_id = p_target_user_id;

  insert into public.ledger_member_events (
    ledger_id, actor_user_id, target_user_id, action, previous_role
  ) values (
    p_ledger_id, auth.uid(), p_target_user_id, 'removed', target_role
  );
end;
$$;

revoke all on function public.remove_ledger_member(uuid, uuid) from public;
grant execute on function public.remove_ledger_member(uuid, uuid)
to authenticated;

create or replace function public.transfer_ledger_ownership(
  p_ledger_id uuid,
  p_target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_role text;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;

  perform 1 from public.encrypted_ledgers
  where id = p_ledger_id and owner_id = auth.uid()
    and type = 'shared' and archived_at is null
  for update;
  if not found then
    raise exception '공동 가계부 소유자만 소유권을 이전할 수 있습니다.';
  end if;

  select role into target_role
  from public.encrypted_ledger_members
  where ledger_id = p_ledger_id and user_id = p_target_user_id
    and status = 'active'
  for update;
  if target_role is null or p_target_user_id = auth.uid() then
    raise exception '소유권을 이전할 멤버를 확인해 주세요.';
  end if;

  update public.encrypted_ledger_members
  set role = 'admin'
  where ledger_id = p_ledger_id and user_id = auth.uid();
  update public.encrypted_ledger_members
  set role = 'owner'
  where ledger_id = p_ledger_id and user_id = p_target_user_id;
  update public.encrypted_ledgers
  set owner_id = p_target_user_id, updated_at = now()
  where id = p_ledger_id;

  insert into public.ledger_member_events (
    ledger_id, actor_user_id, target_user_id, action,
    previous_role, next_role
  ) values (
    p_ledger_id, auth.uid(), p_target_user_id, 'ownership_transferred',
    target_role, 'owner'
  );
end;
$$;

revoke all on function public.transfer_ledger_ownership(uuid, uuid)
from public;
grant execute on function public.transfer_ledger_ownership(uuid, uuid)
to authenticated;

drop function if exists public.create_ledger_invite(uuid);
create function public.create_ledger_invite(
  p_ledger_id uuid,
  p_role_to_grant text default 'member'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  raw_code text;
  code_hash text;
  new_invitation_id uuid;
  expiry timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not public.has_ledger_role(p_ledger_id, array['owner', 'admin']) then
    raise exception '초대 코드를 생성할 권한이 없습니다.';
  end if;
  if p_role_to_grant not in ('admin', 'member', 'viewer') then
    raise exception '초대할 멤버 역할을 확인해 주세요.';
  end if;
  if p_role_to_grant = 'admin' and not public.has_ledger_role(
    p_ledger_id, array['owner']
  ) then
    raise exception '관리자 초대는 가계부 소유자만 만들 수 있습니다.';
  end if;

  loop
    raw_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 8));
    code_hash := private.blind_index('invite|' || raw_code);
    exit when not exists (
      select 1 from public.ledger_invitations
      where invite_token_hash = code_hash
    );
  end loop;

  insert into public.ledger_invitations (
    ledger_id, invited_by, invite_code, invite_token_hash, role_to_grant,
    status, max_uses, used_count, expires_at
  ) values (
    p_ledger_id, auth.uid(), '', code_hash, p_role_to_grant,
    'active', 1, 0, expiry
  ) returning id into new_invitation_id;

  return jsonb_build_object(
    'id', new_invitation_id,
    'inviteCode', raw_code,
    'expiresAt', expiry
  );
end;
$$;

revoke all on function public.create_ledger_invite(uuid, text) from public;
grant execute on function public.create_ledger_invite(uuid, text)
to authenticated;
