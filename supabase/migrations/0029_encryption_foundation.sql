create schema if not exists private;
revoke all on schema private from public;

create extension if not exists supabase_vault with schema vault;

do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'salimon_data_encryption_key_v1'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'salimon_data_encryption_key_v1',
      'Salimon application column-encryption key version 1'
    );
  end if;

  if not exists (
    select 1 from vault.secrets where name = 'salimon_blind_index_key_v1'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'salimon_blind_index_key_v1',
      'Salimon keyed blind-index key version 1'
    );
  end if;
end;
$$;

create or replace function private.data_encryption_key()
returns text
language sql
security definer
stable
set search_path = vault, pg_catalog
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'salimon_data_encryption_key_v1'
  limit 1
$$;

create or replace function private.blind_index_key()
returns text
language sql
security definer
stable
set search_path = vault, pg_catalog
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'salimon_blind_index_key_v1'
  limit 1
$$;

create or replace function private.encrypt_payload(payload jsonb)
returns bytea
language sql
security definer
volatile
set search_path = private, public, pg_catalog
as $$
  select extensions.pgp_sym_encrypt(
    coalesce(payload, '{}'::jsonb)::text,
    private.data_encryption_key(),
    'cipher-algo=aes256, compress-algo=1'
  )
$$;

create or replace function private.decrypt_payload(payload bytea)
returns jsonb
language sql
security definer
stable
set search_path = private, public, pg_catalog
as $$
  select case
    when payload is null then '{}'::jsonb
    else extensions.pgp_sym_decrypt(payload, private.data_encryption_key())::jsonb
  end
$$;

create or replace function private.blind_index(value text)
returns text
language sql
security definer
stable
set search_path = private, public, pg_catalog
as $$
  select case
    when value is null then null
    else encode(
      extensions.hmac(convert_to(lower(trim(value)), 'UTF8'),
        convert_to(private.blind_index_key(), 'UTF8'), 'sha256'),
      'hex'
    )
  end
$$;

revoke all on function private.data_encryption_key() from public;
revoke all on function private.blind_index_key() from public;
revoke all on function private.encrypt_payload(jsonb) from public;
revoke all on function private.decrypt_payload(bytea) from public;
revoke all on function private.blind_index(text) from public;

alter table public.profiles
  add column if not exists private_payload bytea,
  add column if not exists encryption_key_version smallint not null default 1;
alter table public.ledgers
  add column if not exists private_payload bytea,
  add column if not exists encryption_key_version smallint not null default 1;
alter table public.ledger_members
  add column if not exists private_payload bytea,
  add column if not exists encryption_key_version smallint not null default 1;
alter table public.categories
  add column if not exists private_payload bytea,
  add column if not exists name_blind_index text,
  add column if not exists encryption_key_version smallint not null default 1;
alter table public.payment_methods
  add column if not exists private_payload bytea,
  add column if not exists encryption_key_version smallint not null default 1;
alter table public.transactions
  add column if not exists private_payload bytea,
  add column if not exists encryption_key_version smallint not null default 1;
alter table public.category_budgets
  add column if not exists private_payload bytea,
  add column if not exists effective_month_blind_index text,
  add column if not exists encryption_key_version smallint not null default 1;
alter table public.recurring_rules
  add column if not exists private_payload bytea,
  add column if not exists encryption_key_version smallint not null default 1;
alter table public.notification_rules
  add column if not exists private_payload bytea,
  add column if not exists encryption_key_version smallint not null default 1;
alter table public.card_message_samples
  add column if not exists private_payload bytea,
  add column if not exists encryption_key_version smallint not null default 1;

update public.profiles
set private_payload = private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
  'kakao_id', kakao_id,
  'nickname', nickname,
  'avatar_url', avatar_url
)));

update public.ledgers
set private_payload = private.encrypt_payload(jsonb_build_object('name', name));

update public.ledger_members
set private_payload = private.encrypt_payload(jsonb_build_object('nickname', nickname));

update public.categories
set private_payload = private.encrypt_payload(jsonb_build_object('name', name)),
    name_blind_index = private.blind_index(ledger_id::text || '|' || type || '|' || name);

update public.payment_methods
set private_payload = private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
  'name', name,
  'last4', last4,
  'issuer', issuer,
  'payment_day', payment_day,
  'billing_period_end_day', billing_period_end_day,
  'billing_period_end_month_offset', billing_period_end_month_offset
)));

update public.transactions
set private_payload = private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
  'amount', amount,
  'transaction_at', transaction_at,
  'merchant_name', merchant_name,
  'memo', memo,
  'source_app', source_app,
  'source_sender', source_sender
))),
    source_hash = private.blind_index(source_hash);

update public.category_budgets
set private_payload = private.encrypt_payload(jsonb_build_object(
      'effective_month', effective_month,
      'amount', amount
    )),
    effective_month_blind_index = private.blind_index(
      category_id::text || '|' || effective_month::text
    );

update public.recurring_rules
set private_payload = private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
  'amount', amount,
  'day_of_month', day_of_month,
  'time_of_day', time_of_day,
  'start_month', start_month,
  'end_month', end_month,
  'inactive_from_month', inactive_from_month,
  'installment_months', installment_months,
  'merchant_name', merchant_name,
  'memo', memo,
  'purchase_at', purchase_at,
  'installment_principal', installment_principal
)));

update public.notification_rules
set private_payload = private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
  'app_package', app_package,
  'app_label', app_label,
  'sender_filter', sender_filter
)));

update public.card_message_samples
set private_payload = private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
  'card_company_name', card_company_name,
  'masked_message', masked_message,
  'expected_amount', expected_amount,
  'expected_merchant_name', expected_merchant_name,
  'expected_transaction_at', expected_transaction_at,
  'parse_result', parse_result
)));

alter table public.profiles alter column private_payload set not null;
alter table public.ledgers alter column private_payload set not null;
alter table public.ledger_members alter column private_payload set not null;
alter table public.categories alter column private_payload set not null;
alter table public.payment_methods alter column private_payload set not null;
alter table public.transactions alter column private_payload set not null;
alter table public.category_budgets alter column private_payload set not null;
alter table public.recurring_rules alter column private_payload set not null;
alter table public.notification_rules alter column private_payload set not null;
alter table public.card_message_samples alter column private_payload set not null;

-- During the compatibility window, keep ciphertext synchronized while the
-- existing application continues to read and write the plaintext columns.
create or replace function private.sync_encrypted_payload()
returns trigger
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
begin
  case tg_table_name
    when 'profiles' then
      new.private_payload := private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
        'kakao_id', new.kakao_id, 'nickname', new.nickname, 'avatar_url', new.avatar_url
      )));
    when 'ledgers' then
      new.private_payload := private.encrypt_payload(jsonb_build_object('name', new.name));
    when 'ledger_members' then
      new.private_payload := private.encrypt_payload(jsonb_build_object('nickname', new.nickname));
    when 'categories' then
      new.private_payload := private.encrypt_payload(jsonb_build_object('name', new.name));
      new.name_blind_index := private.blind_index(new.ledger_id::text || '|' || new.type || '|' || new.name);
    when 'payment_methods' then
      new.private_payload := private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
        'name', new.name, 'last4', new.last4, 'issuer', new.issuer,
        'payment_day', new.payment_day,
        'billing_period_end_day', new.billing_period_end_day,
        'billing_period_end_month_offset', new.billing_period_end_month_offset
      )));
    when 'transactions' then
      new.private_payload := private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
        'amount', new.amount, 'transaction_at', new.transaction_at,
        'merchant_name', new.merchant_name, 'memo', new.memo,
        'source_app', new.source_app, 'source_sender', new.source_sender
      )));
      if tg_op = 'INSERT' or new.source_hash is distinct from old.source_hash then
        new.source_hash := private.blind_index(new.source_hash);
      end if;
    when 'category_budgets' then
      new.private_payload := private.encrypt_payload(jsonb_build_object(
        'effective_month', new.effective_month, 'amount', new.amount
      ));
      new.effective_month_blind_index := private.blind_index(
        new.category_id::text || '|' || new.effective_month::text
      );
    when 'recurring_rules' then
      new.private_payload := private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
        'amount', new.amount, 'day_of_month', new.day_of_month,
        'time_of_day', new.time_of_day, 'start_month', new.start_month,
        'end_month', new.end_month, 'inactive_from_month', new.inactive_from_month,
        'installment_months', new.installment_months,
        'merchant_name', new.merchant_name, 'memo', new.memo,
        'purchase_at', new.purchase_at,
        'installment_principal', new.installment_principal
      )));
    when 'notification_rules' then
      new.private_payload := private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
        'app_package', new.app_package, 'app_label', new.app_label,
        'sender_filter', new.sender_filter
      )));
    when 'card_message_samples' then
      new.private_payload := private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
        'card_company_name', new.card_company_name,
        'masked_message', new.masked_message,
        'expected_amount', new.expected_amount,
        'expected_merchant_name', new.expected_merchant_name,
        'expected_transaction_at', new.expected_transaction_at,
        'parse_result', new.parse_result
      )));
  end case;

  new.encryption_key_version := 1;
  return new;
end;
$$;

create trigger profiles_sync_encrypted_payload
before insert or update on public.profiles
for each row execute function private.sync_encrypted_payload();
create trigger ledgers_sync_encrypted_payload
before insert or update on public.ledgers
for each row execute function private.sync_encrypted_payload();
create trigger ledger_members_sync_encrypted_payload
before insert or update on public.ledger_members
for each row execute function private.sync_encrypted_payload();
create trigger categories_sync_encrypted_payload
before insert or update on public.categories
for each row execute function private.sync_encrypted_payload();
create trigger payment_methods_sync_encrypted_payload
before insert or update on public.payment_methods
for each row execute function private.sync_encrypted_payload();
create trigger transactions_sync_encrypted_payload
before insert or update on public.transactions
for each row execute function private.sync_encrypted_payload();
create trigger category_budgets_sync_encrypted_payload
before insert or update on public.category_budgets
for each row execute function private.sync_encrypted_payload();
create trigger recurring_rules_sync_encrypted_payload
before insert or update on public.recurring_rules
for each row execute function private.sync_encrypted_payload();
create trigger notification_rules_sync_encrypted_payload
before insert or update on public.notification_rules
for each row execute function private.sync_encrypted_payload();
create trigger card_message_samples_sync_encrypted_payload
before insert or update on public.card_message_samples
for each row execute function private.sync_encrypted_payload();
