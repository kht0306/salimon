-- Cards and bank accounts are user-owned instruments. Ledgers only keep
-- selectable links, visibility, and the per-ledger primary-card preference.

create or replace function public.create_user_payment_instrument(
  p_type text,
  p_name text,
  p_last4 text default null,
  p_issuer text default null,
  p_payment_day int default null,
  p_billing_period_end_day int default null,
  p_billing_period_end_month_offset int default null,
  p_is_debit boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth, pg_catalog
as $$
declare
  new_id uuid := gen_random_uuid();
  normalized_name text := trim(coalesce(p_name, ''));
  normalized_last4 text := nullif(trim(coalesce(p_last4, '')), '');
  normalized_issuer text := nullif(trim(coalesce(p_issuer, '')), '');
  private_data jsonb;
  identity_index text;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if p_type not in ('card', 'bank') then
    raise exception '카드 또는 계좌만 등록할 수 있습니다.';
  end if;
  if normalized_name = '' or char_length(normalized_name) > 60
    or normalized_name ~ '[[:cntrl:]]' then
    raise exception '결제수단 이름은 60자 이내로 입력해 주세요.';
  end if;
  if normalized_issuer is null or char_length(normalized_issuer) > 60
    or normalized_issuer ~ '[[:cntrl:]]' then
    raise exception '카드사 또는 은행을 확인해 주세요.';
  end if;
  if normalized_last4 is not null and normalized_last4 !~ '^[0-9]{4}$' then
    raise exception '끝 4자리는 숫자 4자리로 입력해 주세요.';
  end if;
  if p_type = 'card' and not coalesce(p_is_debit, false) and (
    p_payment_day not between 1 and 31
    or p_billing_period_end_day not between 1 and 31
    or p_billing_period_end_month_offset not in (-1, 0)
  ) then
    raise exception '카드 결제일과 이용기간을 확인해 주세요.';
  end if;

  identity_index := case
    when normalized_last4 is null then null
    else private.blind_index(
      auth.uid()::text || '|' || p_type || '|' || normalized_last4
    )
  end;
  if identity_index is not null and exists (
    select 1 from public.encrypted_user_payment_methods method
    where method.identity_blind_index = identity_index
      and method.deleted_at is null
  ) then
    raise exception '같은 끝 4자리의 결제수단이 이미 등록되어 있습니다.';
  end if;

  private_data := jsonb_strip_nulls(jsonb_build_object(
    'name', normalized_name,
    'last4', normalized_last4,
    'issuer', normalized_issuer,
    'payment_day', case
      when p_type = 'bank' then null
      when coalesce(p_is_debit, false) then 31
      else p_payment_day
    end,
    'billing_period_end_day', case
      when p_type = 'bank' then null
      when coalesce(p_is_debit, false) then 31
      else p_billing_period_end_day
    end,
    'billing_period_end_month_offset', case
      when p_type = 'bank' then null
      when coalesce(p_is_debit, false) then -1
      else p_billing_period_end_month_offset
    end
  ));

  insert into public.encrypted_user_payment_methods (
    id, owner_user_id, type, is_debit, is_active, deleted_at,
    identity_blind_index, private_payload, encryption_key_version
  ) values (
    new_id, auth.uid(), p_type,
    case when p_type = 'card' then coalesce(p_is_debit, false) else false end,
    true, null, identity_index, private.encrypt_payload(private_data), 1
  );
  return new_id;
end;
$$;

revoke all on function public.create_user_payment_instrument(
  text, text, text, text, int, int, int, boolean
) from public;
grant execute on function public.create_user_payment_instrument(
  text, text, text, text, int, int, int, boolean
) to authenticated;

create or replace function public.update_user_payment_instrument(
  p_id uuid,
  p_type text,
  p_name text,
  p_last4 text default null,
  p_issuer text default null,
  p_payment_day int default null,
  p_billing_period_end_day int default null,
  p_billing_period_end_month_offset int default null,
  p_is_debit boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, private, auth, pg_catalog
as $$
declare
  normalized_name text := trim(coalesce(p_name, ''));
  normalized_last4 text := nullif(trim(coalesce(p_last4, '')), '');
  normalized_issuer text := nullif(trim(coalesce(p_issuer, '')), '');
  private_data jsonb;
  identity_index text;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (
    select 1 from public.encrypted_user_payment_methods method
    where method.id = p_id and method.owner_user_id = auth.uid()
      and method.deleted_at is null
    for update
  ) then
    raise exception '수정할 결제수단을 찾을 수 없습니다.';
  end if;
  if p_type not in ('card', 'bank') then
    raise exception '카드 또는 계좌만 수정할 수 있습니다.';
  end if;
  if normalized_name = '' or char_length(normalized_name) > 60
    or normalized_name ~ '[[:cntrl:]]' then
    raise exception '결제수단 이름은 60자 이내로 입력해 주세요.';
  end if;
  if normalized_issuer is null or char_length(normalized_issuer) > 60
    or normalized_issuer ~ '[[:cntrl:]]' then
    raise exception '카드사 또는 은행을 확인해 주세요.';
  end if;
  if normalized_last4 is not null and normalized_last4 !~ '^[0-9]{4}$' then
    raise exception '끝 4자리는 숫자 4자리로 입력해 주세요.';
  end if;
  if p_type = 'card' and not coalesce(p_is_debit, false) and (
    p_payment_day not between 1 and 31
    or p_billing_period_end_day not between 1 and 31
    or p_billing_period_end_month_offset not in (-1, 0)
  ) then
    raise exception '카드 결제일과 이용기간을 확인해 주세요.';
  end if;

  identity_index := case
    when normalized_last4 is null then null
    else private.blind_index(
      auth.uid()::text || '|' || p_type || '|' || normalized_last4
    )
  end;
  if identity_index is not null and exists (
    select 1 from public.encrypted_user_payment_methods method
    where method.identity_blind_index = identity_index
      and method.id <> p_id and method.deleted_at is null
  ) then
    raise exception '같은 끝 4자리의 결제수단이 이미 등록되어 있습니다.';
  end if;

  private_data := jsonb_strip_nulls(jsonb_build_object(
    'name', normalized_name,
    'last4', normalized_last4,
    'issuer', normalized_issuer,
    'payment_day', case
      when p_type = 'bank' then null
      when coalesce(p_is_debit, false) then 31
      else p_payment_day
    end,
    'billing_period_end_day', case
      when p_type = 'bank' then null
      when coalesce(p_is_debit, false) then 31
      else p_billing_period_end_day
    end,
    'billing_period_end_month_offset', case
      when p_type = 'bank' then null
      when coalesce(p_is_debit, false) then -1
      else p_billing_period_end_month_offset
    end
  ));

  update public.encrypted_user_payment_methods
  set type = p_type,
      is_debit = case
        when p_type = 'card' then coalesce(p_is_debit, false)
        else false
      end,
      identity_blind_index = identity_index,
      private_payload = private.encrypt_payload(private_data),
      encryption_key_version = 1,
      updated_at = now()
  where id = p_id and owner_user_id = auth.uid() and deleted_at is null;

  update public.encrypted_ledger_payment_methods
  set type = p_type,
      is_debit = case
        when p_type = 'card' then coalesce(p_is_debit, false)
        else false
      end,
      is_primary = case when p_type = 'card' then is_primary else false end,
      updated_at = now()
  where payment_instrument_id = p_id and owner_user_id = auth.uid();
end;
$$;

revoke all on function public.update_user_payment_instrument(
  uuid, text, text, text, text, int, int, int, boolean
) from public;
grant execute on function public.update_user_payment_instrument(
  uuid, text, text, text, text, int, int, int, boolean
) to authenticated;

create or replace function public.set_user_payment_instrument_active(
  p_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  update public.encrypted_user_payment_methods
  set is_active = p_is_active, updated_at = now()
  where id = p_id and owner_user_id = auth.uid() and deleted_at is null;
  if not found then raise exception '결제수단을 찾을 수 없습니다.'; end if;
end;
$$;

revoke all on function public.set_user_payment_instrument_active(uuid, boolean)
from public;
grant execute on function public.set_user_payment_instrument_active(uuid, boolean)
to authenticated;

create or replace function public.delete_user_payment_instrument(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  update public.encrypted_user_payment_methods
  set is_active = false, deleted_at = now(), updated_at = now()
  where id = p_id and owner_user_id = auth.uid() and deleted_at is null;
  if not found then raise exception '결제수단을 찾을 수 없습니다.'; end if;

  update public.encrypted_ledger_payment_methods
  set is_active = false, is_primary = false,
      deleted_at = coalesce(deleted_at, now()), updated_at = now()
  where payment_instrument_id = p_id and owner_user_id = auth.uid();
end;
$$;

revoke all on function public.delete_user_payment_instrument(uuid) from public;
grant execute on function public.delete_user_payment_instrument(uuid)
to authenticated;

drop function if exists public.sync_my_ledger_payment_methods(
  uuid, uuid[], uuid[]
);
create function public.sync_my_ledger_payment_methods(
  p_ledger_id uuid,
  p_payment_instrument_ids uuid[] default array[]::uuid[],
  p_ledger_visible_instrument_ids uuid[] default array[]::uuid[],
  p_primary_instrument_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, private, auth, pg_catalog
as $$
declare
  target_ledger_type text;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  select ledger.type into target_ledger_type
  from public.encrypted_ledgers ledger
  where ledger.id = p_ledger_id and ledger.archived_at is null;
  if target_ledger_type is null then raise exception '가계부를 찾을 수 없습니다.'; end if;
  if not public.has_ledger_role(
    p_ledger_id, array['owner', 'admin', 'member']
  ) then
    raise exception '이 가계부에 카드·계좌를 연결할 권한이 없습니다.';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_payment_instrument_ids, array[]::uuid[])) id
    where not exists (
      select 1 from public.encrypted_user_payment_methods method
      where method.id = id and method.owner_user_id = auth.uid()
        and method.deleted_at is null and method.is_active
    )
  ) then
    raise exception '사용할 수 없는 카드 또는 계좌가 포함되어 있습니다.';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_ledger_visible_instrument_ids, array[]::uuid[])) id
    where not id = any(coalesce(p_payment_instrument_ids, array[]::uuid[]))
  ) then
    raise exception '공개할 결제수단은 먼저 가계부에 연결해야 합니다.';
  end if;
  if p_primary_instrument_id is not null and (
    not p_primary_instrument_id = any(
      coalesce(p_payment_instrument_ids, array[]::uuid[])
    ) or not exists (
      select 1 from public.encrypted_user_payment_methods method
      where method.id = p_primary_instrument_id
        and method.owner_user_id = auth.uid()
        and method.type = 'card' and method.is_active
        and method.deleted_at is null
    )
  ) then
    raise exception '주 카드는 연결한 활성 카드 중에서 선택해 주세요.';
  end if;

  update public.encrypted_ledger_payment_methods link
  set is_active = false, visibility = 'private', is_primary = false,
      updated_at = now()
  where link.ledger_id = p_ledger_id
    and link.owner_user_id = auth.uid()
    and link.deleted_at is null
    and not link.payment_instrument_id = any(
      coalesce(p_payment_instrument_ids, array[]::uuid[])
    );

  -- Clear first so changing the primary card cannot collide with the
  -- one-primary-per-user-and-ledger partial unique index during the upsert.
  update public.encrypted_ledger_payment_methods link
  set is_primary = false, updated_at = now()
  where link.ledger_id = p_ledger_id
    and link.owner_user_id = auth.uid()
    and link.deleted_at is null and link.is_primary;

  insert into public.encrypted_ledger_payment_methods (
    ledger_id, payment_instrument_id, owner_user_id, name, type,
    visibility, is_active, is_primary, is_debit, private_payload,
    encryption_key_version
  )
  select
    p_ledger_id, method.id, method.owner_user_id, '', method.type,
    case
      when target_ledger_type = 'shared' and method.id = any(coalesce(
        p_ledger_visible_instrument_ids, array[]::uuid[]
      )) then 'ledger'
      else 'private'
    end,
    true, coalesce(method.id = p_primary_instrument_id, false), method.is_debit,
    private.encrypt_payload('{}'::jsonb), 1
  from public.encrypted_user_payment_methods method
  where method.owner_user_id = auth.uid() and method.deleted_at is null
    and method.is_active
    and method.id = any(coalesce(p_payment_instrument_ids, array[]::uuid[]))
  on conflict (ledger_id, payment_instrument_id) where deleted_at is null
  do update set
    is_active = true,
    visibility = excluded.visibility,
    is_primary = excluded.is_primary,
    updated_at = now();

  update public.encrypted_ledger_payment_methods link
  set is_primary = coalesce(
        link.payment_instrument_id = p_primary_instrument_id, false
      ),
      updated_at = now()
  where link.ledger_id = p_ledger_id
    and link.owner_user_id = auth.uid()
    and link.deleted_at is null and link.is_active;
end;
$$;

revoke all on function public.sync_my_ledger_payment_methods(
  uuid, uuid[], uuid[], uuid
) from public;
grant execute on function public.sync_my_ledger_payment_methods(
  uuid, uuid[], uuid[], uuid
) to authenticated;

-- Keep the three-argument signature during the rolling web deployment.
create function public.sync_my_ledger_payment_methods(
  p_ledger_id uuid,
  p_payment_instrument_ids uuid[] default array[]::uuid[],
  p_ledger_visible_instrument_ids uuid[] default array[]::uuid[]
)
returns void
language sql
security definer
set search_path = public, auth, pg_catalog
as $$
  select public.sync_my_ledger_payment_methods(
    p_ledger_id,
    p_payment_instrument_ids,
    p_ledger_visible_instrument_ids,
    null
  );
$$;

revoke all on function public.sync_my_ledger_payment_methods(
  uuid, uuid[], uuid[]
) from public;
grant execute on function public.sync_my_ledger_payment_methods(
  uuid, uuid[], uuid[]
) to authenticated;

-- Personal ledgers cannot own invitations. They must be converted first.
update public.ledger_invitations invitation
set status = 'revoked'
from public.encrypted_ledgers ledger
where ledger.id = invitation.ledger_id and ledger.type = 'personal'
  and invitation.status = 'active';

drop function if exists public.create_ledger_invite(uuid, text);
create function public.create_ledger_invite(
  p_ledger_id uuid,
  p_role_to_grant text default 'member'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth, pg_catalog
as $$
declare
  raw_code text;
  code_hash text;
  new_invitation_id uuid;
  expiry timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (
    select 1 from public.encrypted_ledgers ledger
    where ledger.id = p_ledger_id and ledger.type = 'shared'
      and ledger.archived_at is null
  ) then
    raise exception '개인 가계부를 공동 가계부로 전환한 뒤 초대해 주세요.';
  end if;
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
