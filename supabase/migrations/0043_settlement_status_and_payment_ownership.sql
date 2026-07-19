-- Settlement uses a two-state rule: confirmed transactions are included and
-- excluded transactions remain visible for audit but never affect totals.
-- Pending rows and rules are removed before tightening the constraints.

delete from public.encrypted_transactions
where status = 'pending';

delete from public.encrypted_recurring_rules
where transaction_status = 'pending';

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.encrypted_transactions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%pending%'
  loop
    execute format(
      'alter table public.encrypted_transactions drop constraint %I',
      constraint_name
    );
  end loop;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.encrypted_recurring_rules'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%transaction_status%pending%'
  loop
    execute format(
      'alter table public.encrypted_recurring_rules drop constraint %I',
      constraint_name
    );
  end loop;
end;
$$;

alter table public.encrypted_transactions
  add constraint encrypted_transactions_status_check
  check (status in ('confirmed', 'excluded'));

alter table public.encrypted_recurring_rules
  add constraint encrypted_recurring_rules_transaction_status_check
  check (transaction_status in ('confirmed', 'excluded'));

-- Receipt AI is a distinct source so users can identify imported entries.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.encrypted_transactions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%source_type%'
  loop
    execute format(
      'alter table public.encrypted_transactions drop constraint %I',
      constraint_name
    );
  end loop;
end;
$$;

alter table public.encrypted_transactions
  add constraint encrypted_transactions_source_type_check
  check (source_type in (
    'manual', 'android_sms_notification', 'paste', 'import', 'receipt_ai'
  ));

-- A member may register and edit only their own card or account. Other
-- members' shared instruments stay selectable for transactions but read-only.
create or replace function private.write_payment_methods_view()
returns trigger
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
declare
  private_data jsonb;
  instrument_id uuid;
  identity_index text;
  target_owner uuid;
  target_ledger_type text;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;

  if tg_op = 'DELETE' then
    if old.owner_user_id is distinct from auth.uid() then
      raise exception '결제수단 소유자만 삭제할 수 있습니다.';
    end if;
    delete from public.encrypted_ledger_payment_methods where id = old.id;
    return old;
  end if;

  if trim(coalesce(new.name, '')) = '' then
    raise exception '카드 또는 계좌 이름을 입력해 주세요.';
  end if;
  if new.type not in ('card', 'bank') then
    raise exception '카드 또는 계좌만 등록할 수 있습니다.';
  end if;
  if not public.has_ledger_role(
    new.ledger_id, array['owner', 'admin', 'member']
  ) then
    raise exception '이 가계부에 결제수단을 등록할 권한이 없습니다.';
  end if;

  target_owner := auth.uid();
  if new.owner_user_id is not null and new.owner_user_id <> target_owner then
    raise exception '본인 소유의 카드 또는 계좌만 등록할 수 있습니다.';
  end if;

  select type into target_ledger_type
  from public.encrypted_ledgers where id = new.ledger_id;
  new.visibility := case
    when target_ledger_type = 'personal' then 'private'
    else coalesce(new.visibility, 'private')
  end;

  private_data := jsonb_strip_nulls(jsonb_build_object(
    'name', trim(new.name), 'last4', nullif(trim(new.last4), ''),
    'issuer', new.issuer, 'payment_day', new.payment_day,
    'billing_period_end_day', new.billing_period_end_day,
    'billing_period_end_month_offset', new.billing_period_end_month_offset
  ));
  identity_index := case
    when nullif(trim(new.last4), '') is null then null
    else private.blind_index(
      target_owner::text || '|' || new.type || '|' || trim(new.last4)
    )
  end;

  if tg_op = 'INSERT' then
    if identity_index is not null then
      select id into instrument_id
      from public.encrypted_user_payment_methods
      where identity_blind_index = identity_index and deleted_at is null;
    end if;

    if instrument_id is null then
      instrument_id := coalesce(new.payment_instrument_id, gen_random_uuid());
      insert into public.encrypted_user_payment_methods (
        id, owner_user_id, type, is_debit, private_payload,
        identity_blind_index, encryption_key_version
      ) values (
        instrument_id, target_owner, new.type, coalesce(new.is_debit, false),
        private.encrypt_payload(private_data), identity_index, 1
      );
    end if;

    if exists (
      select 1 from public.encrypted_ledger_payment_methods
      where ledger_id = new.ledger_id
        and payment_instrument_id = instrument_id
        and deleted_at is null
    ) then
      raise exception '이미 이 가계부에 연결된 카드 또는 계좌입니다.';
    end if;

    new.id := coalesce(new.id, gen_random_uuid());
    new.owner_user_id := target_owner;
    new.payment_instrument_id := instrument_id;
    new.is_active := coalesce(new.is_active, true);
    new.is_primary := coalesce(new.is_primary, false);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());
    insert into public.encrypted_ledger_payment_methods (
      id, ledger_id, payment_instrument_id, owner_user_id, name, type,
      visibility, is_active, created_at, updated_at, deleted_at, is_primary,
      is_debit, private_payload, encryption_key_version
    ) values (
      new.id, new.ledger_id, instrument_id, target_owner, '', new.type,
      new.visibility, new.is_active, new.created_at, new.updated_at,
      new.deleted_at, new.is_primary, coalesce(new.is_debit, false),
      private.encrypt_payload('{}'::jsonb), 1
    );
    return new;
  end if;

  instrument_id := old.payment_instrument_id;
  if old.owner_user_id is distinct from auth.uid() then
    raise exception '결제수단 소유자만 정보를 변경할 수 있습니다.';
  end if;
  if new.ledger_id is distinct from old.ledger_id
    or new.payment_instrument_id is distinct from old.payment_instrument_id then
    raise exception '결제수단의 가계부 연결 정보는 변경할 수 없습니다.';
  end if;
  if new.owner_user_id is distinct from old.owner_user_id then
    raise exception '결제수단 소유자는 변경할 수 없습니다.';
  end if;

  update public.encrypted_user_payment_methods
  set type = new.type,
      is_debit = coalesce(new.is_debit, false),
      identity_blind_index = identity_index,
      private_payload = private.encrypt_payload(private_data),
      encryption_key_version = 1,
      updated_at = now()
  where id = instrument_id;

  new.id := old.id;
  new.payment_instrument_id := instrument_id;
  update public.encrypted_ledger_payment_methods
  set visibility = new.visibility,
      is_active = new.is_active,
      updated_at = coalesce(new.updated_at, now()),
      deleted_at = new.deleted_at,
      is_primary = new.is_primary
  where id = old.id;
  return new;
end;
$$;

alter function private.write_payment_methods_view()
  owner to salimon_crypto_writer;
revoke all on function private.write_payment_methods_view() from public;
