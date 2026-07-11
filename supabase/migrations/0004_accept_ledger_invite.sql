create or replace function public.accept_ledger_invite(submitted_code text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invitation public.ledger_invitations%rowtype;
  display_name text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into invitation
  from public.ledger_invitations
  where invite_code = upper(trim(submitted_code))
  for update;

  if invitation.id is null then
    raise exception '유효하지 않은 초대코드입니다.';
  end if;

  if invitation.status <> 'active' or invitation.expires_at <= now() then
    raise exception '만료되었거나 사용할 수 없는 초대코드입니다.';
  end if;

  if invitation.used_count >= invitation.max_uses then
    raise exception '이미 사용된 초대코드입니다.';
  end if;

  if exists (
    select 1 from public.ledger_members
    where ledger_id = invitation.ledger_id
      and user_id = auth.uid()
      and status = 'active'
  ) then
    raise exception '이미 참여 중인 가계부입니다.';
  end if;

  select nickname into display_name
  from public.profiles
  where id = auth.uid();

  insert into public.ledger_members (ledger_id, user_id, nickname, role, status, removed_at)
  values (
    invitation.ledger_id,
    auth.uid(),
    coalesce(display_name, '공동 멤버'),
    invitation.role_to_grant,
    'active',
    null
  )
  on conflict (ledger_id, user_id) do update
  set nickname = excluded.nickname,
      role = excluded.role,
      status = 'active',
      removed_at = null;

  update public.ledger_invitations
  set used_count = used_count + 1,
      status = case when used_count + 1 >= max_uses then 'accepted' else status end,
      accepted_at = now(),
      accepted_by = auth.uid()
  where id = invitation.id;

  return invitation.ledger_id;
end;
$$;

revoke all on function public.accept_ledger_invite(text) from public;
grant execute on function public.accept_ledger_invite(text) to authenticated;
