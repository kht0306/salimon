-- Personal-to-shared conversion selects from user-owned payment instruments,
-- not only from links that already exist in the personal ledger. Legacy clients
-- that still submit ledger payment-method link ids remain supported.

create or replace function public.convert_personal_ledger_to_shared(
  p_ledger_id uuid,
  p_shared_payment_method_ids uuid[] default array[]::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  selected_instrument_ids uuid[] := array[]::uuid[];
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (
    select 1 from public.ledgers
    where id = p_ledger_id and owner_id = auth.uid() and type = 'personal'
  ) then
    raise exception '소유한 개인 가계부만 공동으로 전환할 수 있습니다.';
  end if;

  if exists (
    select 1
    from unnest(
      coalesce(p_shared_payment_method_ids, array[]::uuid[])
    ) requested(id)
    where not exists (
      select 1
      from public.encrypted_user_payment_methods instrument
      where instrument.id = requested.id
        and instrument.owner_user_id = auth.uid()
        and instrument.deleted_at is null
    )
    and not exists (
      select 1
      from public.encrypted_ledger_payment_methods link
      where link.id = requested.id
        and link.ledger_id = p_ledger_id
        and link.owner_user_id = auth.uid()
        and link.deleted_at is null
    )
  ) then
    raise exception '공개할 수 없는 카드 또는 계좌가 포함되어 있습니다.';
  end if;

  select coalesce(array_agg(distinct resolved.instrument_id), array[]::uuid[])
  into selected_instrument_ids
  from (
    select instrument.id as instrument_id
    from public.encrypted_user_payment_methods instrument
    where instrument.owner_user_id = auth.uid()
      and instrument.deleted_at is null
      and instrument.id = any(
        coalesce(p_shared_payment_method_ids, array[]::uuid[])
      )
    union
    select link.payment_instrument_id
    from public.encrypted_ledger_payment_methods link
    where link.ledger_id = p_ledger_id
      and link.owner_user_id = auth.uid()
      and link.deleted_at is null
      and link.id = any(
        coalesce(p_shared_payment_method_ids, array[]::uuid[])
      )
  ) resolved;

  insert into public.encrypted_ledger_payment_methods (
    ledger_id, payment_instrument_id, owner_user_id, name, type,
    visibility, is_active, is_primary, is_debit, private_payload,
    encryption_key_version
  )
  select
    p_ledger_id, instrument.id, instrument.owner_user_id, '', instrument.type,
    'ledger', true, false, instrument.is_debit,
    private.encrypt_payload('{}'::jsonb), 1
  from public.encrypted_user_payment_methods instrument
  where instrument.owner_user_id = auth.uid()
    and instrument.deleted_at is null
    and instrument.id = any(selected_instrument_ids)
  on conflict (ledger_id, payment_instrument_id) where deleted_at is null
  do update set
    is_active = true,
    visibility = 'ledger',
    updated_at = now();

  update public.encrypted_ledger_payment_methods link
  set visibility = case
        when link.payment_instrument_id = any(selected_instrument_ids)
          then 'ledger'
        else 'private'
      end,
      updated_at = now()
  where link.ledger_id = p_ledger_id
    and link.owner_user_id = auth.uid()
    and link.deleted_at is null;

  update public.ledgers
  set type = 'shared', updated_at = now()
  where id = p_ledger_id;
end;
$$;

revoke all on function public.convert_personal_ledger_to_shared(uuid, uuid[])
from public;
grant execute on function public.convert_personal_ledger_to_shared(uuid, uuid[])
to authenticated;
