drop function if exists public.accept_ledger_invite(text);

create function public.accept_ledger_invite(submitted_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  invitation public.ledger_invitations%rowtype;
  display_name text;
  submitted_hash text;
  recent_attempts int;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;

  delete from private.invite_attempts
  where attempted_at < now() - interval '1 day';

  select count(*) into recent_attempts
  from private.invite_attempts
  where user_id = auth.uid() and attempted_at >= now() - interval '10 minutes';

  if recent_attempts >= 10 then
    raise exception '초대 코드 확인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  end if;

  insert into private.invite_attempts (user_id, succeeded)
  values (auth.uid(), false);

  submitted_hash := private.blind_index('invite|' || upper(trim(submitted_code)));
  select * into invitation
  from public.ledger_invitations
  where invite_token_hash = submitted_hash
  for update;

  if invitation.id is null then
    return jsonb_build_object('status', 'invalid_or_expired');
  end if;

  if exists (
    select 1 from public.ledger_members
    where ledger_id = invitation.ledger_id
      and user_id = auth.uid() and status = 'active'
  ) then
    update private.invite_attempts
    set succeeded = true
    where id = (
      select id from private.invite_attempts
      where user_id = auth.uid()
      order by attempted_at desc, id desc limit 1
    );
    return jsonb_build_object(
      'status', 'already_member',
      'ledgerId', invitation.ledger_id
    );
  end if;

  if invitation.status <> 'active'
    or invitation.expires_at <= now()
    or invitation.used_count >= invitation.max_uses then
    return jsonb_build_object('status', 'invalid_or_expired');
  end if;

  select nickname into display_name from public.profiles where id = auth.uid();
  if exists (
    select 1 from public.ledger_members
    where ledger_id = invitation.ledger_id and user_id = auth.uid()
  ) then
    update public.encrypted_ledger_members
    set nickname = '', role = invitation.role_to_grant, status = 'active',
        removed_at = null,
        private_payload = private.encrypt_payload(jsonb_build_object(
          'nickname', coalesce(display_name, '공동 멤버')
        )),
        encryption_key_version = 1
    where ledger_id = invitation.ledger_id and user_id = auth.uid();
  else
    insert into public.encrypted_ledger_members (
      ledger_id, user_id, nickname, role, status, removed_at,
      private_payload, encryption_key_version
    ) values (
      invitation.ledger_id, auth.uid(), '', invitation.role_to_grant,
      'active', null,
      private.encrypt_payload(jsonb_build_object(
        'nickname', coalesce(display_name, '공동 멤버')
      )), 1
    );
  end if;

  update public.ledger_invitations
  set used_count = used_count + 1,
      status = case when used_count + 1 >= max_uses then 'accepted' else status end,
      accepted_at = now(), accepted_by = auth.uid()
  where id = invitation.id;

  update private.invite_attempts
  set succeeded = true
  where id = (
    select id from private.invite_attempts
    where user_id = auth.uid()
    order by attempted_at desc, id desc limit 1
  );

  return jsonb_build_object(
    'status', 'accepted',
    'ledgerId', invitation.ledger_id
  );
end;
$$;

revoke all on function public.accept_ledger_invite(text) from public;
grant execute on function public.accept_ledger_invite(text) to authenticated;

create or replace function public.sync_my_ledger_payment_methods(
  p_ledger_id uuid,
  p_payment_instrument_ids uuid[] default array[]::uuid[],
  p_ledger_visible_instrument_ids uuid[] default array[]::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, private, auth
as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (
    select 1 from public.ledgers ledger
    where ledger.id = p_ledger_id
      and ledger.type = 'shared'
      and ledger.archived_at is null
  ) then
    raise exception '카드·계좌를 연결할 수 있는 공동 가계부가 아닙니다.';
  end if;
  if not public.is_ledger_member(p_ledger_id) then
    raise exception '가계부에 참여한 사용자만 카드·계좌를 연결할 수 있습니다.';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_payment_instrument_ids, array[]::uuid[])) id
    where not exists (
      select 1 from public.encrypted_user_payment_methods method
      where method.id = id
        and method.owner_user_id = auth.uid()
        and method.deleted_at is null
    )
  ) then
    raise exception '본인 소유가 아닌 카드 또는 계좌가 포함되어 있습니다.';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_ledger_visible_instrument_ids, array[]::uuid[])) id
    where not id = any(coalesce(p_payment_instrument_ids, array[]::uuid[]))
  ) then
    raise exception '공개할 카드·계좌는 먼저 가계부에 연결해야 합니다.';
  end if;

  update public.encrypted_ledger_payment_methods link
  set is_active = false,
      visibility = 'private',
      is_primary = false,
      updated_at = now()
  where link.ledger_id = p_ledger_id
    and link.owner_user_id = auth.uid()
    and link.deleted_at is null
    and not link.payment_instrument_id = any(
      coalesce(p_payment_instrument_ids, array[]::uuid[])
    );

  insert into public.encrypted_ledger_payment_methods (
    ledger_id, payment_instrument_id, owner_user_id, name, type,
    visibility, is_active, is_primary, is_debit, private_payload,
    encryption_key_version
  )
  select
    p_ledger_id, method.id, method.owner_user_id, '', method.type,
    case
      when method.id = any(coalesce(
        p_ledger_visible_instrument_ids, array[]::uuid[]
      )) then 'ledger'
      else 'private'
    end,
    true, false, method.is_debit, private.encrypt_payload('{}'::jsonb), 1
  from public.encrypted_user_payment_methods method
  where method.owner_user_id = auth.uid()
    and method.deleted_at is null
    and method.id = any(coalesce(p_payment_instrument_ids, array[]::uuid[]))
  on conflict (ledger_id, payment_instrument_id) where deleted_at is null
  do update set
    is_active = true,
    visibility = excluded.visibility,
    updated_at = now();
end;
$$;

revoke all on function public.sync_my_ledger_payment_methods(uuid, uuid[], uuid[])
from public;
grant execute on function public.sync_my_ledger_payment_methods(uuid, uuid[], uuid[])
to authenticated;
