drop trigger if exists profiles_sync_encrypted_payload on public.profiles;
drop trigger if exists ledgers_sync_encrypted_payload on public.ledgers;
drop trigger if exists ledger_members_sync_encrypted_payload on public.ledger_members;
drop trigger if exists categories_sync_encrypted_payload on public.categories;
drop trigger if exists payment_methods_sync_encrypted_payload on public.payment_methods;
drop trigger if exists transactions_sync_encrypted_payload on public.transactions;
drop trigger if exists category_budgets_sync_encrypted_payload on public.category_budgets;
drop trigger if exists recurring_rules_sync_encrypted_payload on public.recurring_rules;
drop trigger if exists notification_rules_sync_encrypted_payload on public.notification_rules;
drop trigger if exists card_message_samples_sync_encrypted_payload on public.card_message_samples;

drop index if exists public.categories_ledger_type_name_active_uidx;
drop index if exists public.transactions_ledger_date_idx;
drop index if exists public.transactions_created_by_date_idx;
alter table public.category_budgets
  drop constraint if exists category_budgets_category_id_effective_month_key;

alter table public.profiles rename to encrypted_profiles;
alter table public.ledgers rename to encrypted_ledgers;
alter table public.ledger_members rename to encrypted_ledger_members;
alter table public.categories rename to encrypted_categories;
alter table public.payment_methods rename to encrypted_payment_methods;
alter table public.transactions rename to encrypted_transactions;
alter table public.category_budgets rename to encrypted_category_budgets;
alter table public.recurring_rules rename to encrypted_recurring_rules;
alter table public.notification_rules rename to encrypted_notification_rules;
alter table public.card_message_samples rename to encrypted_card_message_samples;

update public.encrypted_profiles
set kakao_id = null, nickname = null, avatar_url = null;
update public.encrypted_ledgers set name = '';
update public.encrypted_ledger_members set nickname = '';
update public.encrypted_categories set name = '';
update public.encrypted_payment_methods
set name = '', last4 = null, issuer = null, payment_day = null,
    billing_period_end_day = null, billing_period_end_month_offset = null;
update public.encrypted_payment_methods p
set visibility = 'private'
from public.encrypted_ledgers l
where l.id = p.ledger_id and l.type = 'personal';
update public.encrypted_transactions
set amount = 0, transaction_at = '1970-01-01 00:00:00+00',
    merchant_name = null, memo = null, source_app = null, source_sender = null;
update public.encrypted_category_budgets
set effective_month = '1970-01-01', amount = 0;
update public.encrypted_recurring_rules
set amount = 1, day_of_month = 1, time_of_day = '00:00',
    start_month = '1970-01-01', end_month = null,
    inactive_from_month = null, installment_months = null,
    merchant_name = null, memo = null, purchase_at = null,
    installment_principal = null;
update public.encrypted_notification_rules
set app_package = '', app_label = null, sender_filter = null;
update public.encrypted_card_message_samples
set card_company_name = null, masked_message = '', expected_amount = null,
    expected_merchant_name = null, expected_transaction_at = null,
    parse_result = null;

create unique index categories_ledger_type_name_secure_uidx
on public.encrypted_categories (ledger_id, type, name_blind_index)
where is_archived = false;

create unique index category_budgets_category_month_secure_uidx
on public.encrypted_category_budgets (category_id, effective_month_blind_index);

grant usage on schema private to authenticated;
grant execute on function private.decrypt_payload(bytea) to authenticated;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'salimon_crypto_writer') then
    create role salimon_crypto_writer nologin inherit;
  end if;
end;
$$;
grant authenticated to salimon_crypto_writer;
grant salimon_crypto_writer to postgres;
grant usage, create on schema private to salimon_crypto_writer;
grant execute on function private.encrypt_payload(jsonb) to salimon_crypto_writer;
grant execute on function private.blind_index(text) to salimon_crypto_writer;

create or replace function private.is_ledger_owner(target_ledger_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.encrypted_ledgers l
    where l.id = target_ledger_id and l.owner_id = auth.uid()
  )
$$;
revoke all on function private.is_ledger_owner(uuid) from public;
grant execute on function private.is_ledger_owner(uuid)
to salimon_crypto_writer;

create policy "categories_insert_ledger_owner_bootstrap"
on public.encrypted_categories for insert to salimon_crypto_writer
with check (private.is_ledger_owner(ledger_id));

create policy "ledger_members_insert_owner_bootstrap"
on public.encrypted_ledger_members for insert to salimon_crypto_writer
with check (
  user_id = auth.uid()
  and role = 'owner'
  and private.is_ledger_owner(ledger_id)
);

create view public.profiles
with (security_invoker = true)
as
select
  p.id,
  d.payload ->> 'kakao_id' as kakao_id,
  d.payload ->> 'nickname' as nickname,
  d.payload ->> 'avatar_url' as avatar_url,
  p.default_currency,
  p.timezone,
  p.created_at,
  p.updated_at
from public.encrypted_profiles p
cross join lateral (
  select private.decrypt_payload(p.private_payload) as payload
) d;

create view public.ledgers
with (security_invoker = true)
as
select
  l.id,
  l.owner_id,
  d.payload ->> 'name' as name,
  l.type,
  l.currency,
  l.created_at,
  l.updated_at
from public.encrypted_ledgers l
cross join lateral (
  select private.decrypt_payload(l.private_payload) as payload
) d;

create view public.ledger_members
with (security_invoker = true)
as
select
  m.id,
  m.ledger_id,
  m.user_id,
  m.role,
  m.status,
  m.joined_at,
  m.removed_at,
  d.payload ->> 'nickname' as nickname,
  m.is_default
from public.encrypted_ledger_members m
cross join lateral (
  select private.decrypt_payload(m.private_payload) as payload
) d;

create view public.categories
with (security_invoker = true)
as
select
  c.id,
  c.ledger_id,
  c.created_by,
  c.type,
  d.payload ->> 'name' as name,
  c.icon,
  c.color,
  c.sort_order,
  c.is_default,
  c.is_archived,
  c.created_at,
  c.updated_at
from public.encrypted_categories c
cross join lateral (
  select private.decrypt_payload(c.private_payload) as payload
) d;

create view public.payment_methods
with (security_invoker = true)
as
select
  p.id,
  p.ledger_id,
  p.owner_user_id,
  d.payload ->> 'name' as name,
  p.type,
  d.payload ->> 'last4' as last4,
  d.payload ->> 'issuer' as issuer,
  p.visibility,
  p.is_active,
  p.created_at,
  p.updated_at,
  (d.payload ->> 'payment_day')::int as payment_day,
  (d.payload ->> 'billing_period_end_day')::int as billing_period_end_day,
  (d.payload ->> 'billing_period_end_month_offset')::int
    as billing_period_end_month_offset,
  p.deleted_at,
  p.is_primary,
  p.is_debit
from public.encrypted_payment_methods p
cross join lateral (
  select private.decrypt_payload(p.private_payload) as payload
) d;

create view public.transactions
with (security_invoker = true)
as
select
  t.id,
  t.ledger_id,
  t.created_by,
  t.updated_by,
  t.type,
  t.status,
  (d.payload ->> 'amount')::numeric as amount,
  t.currency,
  (d.payload ->> 'transaction_at')::timestamptz as transaction_at,
  t.category_id,
  t.payment_method_id,
  d.payload ->> 'merchant_name' as merchant_name,
  d.payload ->> 'memo' as memo,
  t.source_type,
  d.payload ->> 'source_app' as source_app,
  d.payload ->> 'source_sender' as source_sender,
  t.source_hash,
  t.parse_confidence,
  t.created_at,
  t.updated_at,
  t.deleted_at,
  t.actor_user_id,
  t.recurring_rule_id,
  t.recurring_type,
  t.installment_number,
  t.installment_total
from public.encrypted_transactions t
cross join lateral (
  select private.decrypt_payload(t.private_payload) as payload
) d;

create view public.category_budgets
with (security_invoker = true)
as
select
  b.id,
  b.ledger_id,
  b.category_id,
  (d.payload ->> 'effective_month')::date as effective_month,
  (d.payload ->> 'amount')::numeric as amount,
  b.created_by,
  b.created_at
from public.encrypted_category_budgets b
cross join lateral (
  select private.decrypt_payload(b.private_payload) as payload
) d;

create view public.recurring_rules
with (security_invoker = true)
as
select
  r.id,
  r.ledger_id,
  r.created_by,
  r.rule_type,
  (d.payload ->> 'amount')::numeric as amount,
  (d.payload ->> 'day_of_month')::int as day_of_month,
  (d.payload ->> 'time_of_day')::time as time_of_day,
  (d.payload ->> 'start_month')::date as start_month,
  (d.payload ->> 'end_month')::date as end_month,
  (d.payload ->> 'inactive_from_month')::date as inactive_from_month,
  (d.payload ->> 'installment_months')::int as installment_months,
  r.category_id,
  d.payload ->> 'merchant_name' as merchant_name,
  d.payload ->> 'memo' as memo,
  r.is_active,
  r.created_at,
  r.updated_at,
  r.transaction_type,
  r.transaction_status,
  r.actor_user_id,
  (d.payload ->> 'purchase_at')::timestamptz as purchase_at,
  r.payment_method_id,
  r.installment_amount_type,
  (d.payload ->> 'installment_principal')::numeric as installment_principal
from public.encrypted_recurring_rules r
cross join lateral (
  select private.decrypt_payload(r.private_payload) as payload
) d;

create view public.notification_rules
with (security_invoker = true)
as
select
  n.id,
  n.user_id,
  n.ledger_id,
  d.payload ->> 'app_package' as app_package,
  d.payload ->> 'app_label' as app_label,
  d.payload ->> 'sender_filter' as sender_filter,
  n.is_enabled,
  n.created_at,
  n.updated_at
from public.encrypted_notification_rules n
cross join lateral (
  select private.decrypt_payload(n.private_payload) as payload
) d;

create view public.card_message_samples
with (security_invoker = true)
as
select
  s.id,
  s.submitted_by,
  d.payload ->> 'card_company_name' as card_company_name,
  d.payload ->> 'masked_message' as masked_message,
  (d.payload ->> 'expected_amount')::numeric as expected_amount,
  d.payload ->> 'expected_merchant_name' as expected_merchant_name,
  (d.payload ->> 'expected_transaction_at')::timestamptz
    as expected_transaction_at,
  d.payload -> 'parse_result' as parse_result,
  s.consent_version,
  s.status,
  s.created_at,
  s.reviewed_at,
  s.reviewed_by
from public.encrypted_card_message_samples s
cross join lateral (
  select private.decrypt_payload(s.private_payload) as payload
) d;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.ledgers to authenticated;
grant select, insert, update, delete on public.ledger_members to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.payment_methods to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.category_budgets to authenticated;
grant select, insert, update, delete on public.recurring_rules to authenticated;
grant select, insert, update, delete on public.notification_rules to authenticated;
grant select, insert, update, delete on public.card_message_samples to authenticated;

create or replace function private.write_profiles_view()
returns trigger language plpgsql security definer
set search_path = private, public, pg_catalog as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());
    insert into public.encrypted_profiles (
      id, kakao_id, nickname, avatar_url, default_currency, timezone,
      created_at, updated_at, private_payload, encryption_key_version
    ) values (
      new.id, null, null, null, coalesce(new.default_currency, 'KRW'),
      coalesce(new.timezone, 'Asia/Seoul'), new.created_at, new.updated_at,
      private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
        'kakao_id', new.kakao_id, 'nickname', new.nickname,
        'avatar_url', new.avatar_url
      ))), 1
    );
    return new;
  elsif tg_op = 'UPDATE' then
    new.id := old.id;
    update public.encrypted_profiles
    set default_currency = new.default_currency,
        timezone = new.timezone,
        updated_at = coalesce(new.updated_at, now()),
        private_payload = private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
          'kakao_id', new.kakao_id, 'nickname', new.nickname,
          'avatar_url', new.avatar_url
        ))),
        encryption_key_version = 1
    where id = old.id;
    return new;
  else
    delete from public.encrypted_profiles where id = old.id;
    return old;
  end if;
end;
$$;

create trigger profiles_secure_write
instead of insert or update or delete on public.profiles
for each row execute function private.write_profiles_view();

create or replace function private.write_ledgers_view()
returns trigger language plpgsql security definer
set search_path = private, public, pg_catalog as $$
begin
  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid());
    new.type := coalesce(new.type, 'personal');
    new.currency := coalesce(new.currency, 'KRW');
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());
    insert into public.encrypted_ledgers (
      id, owner_id, name, type, currency, created_at, updated_at,
      private_payload, encryption_key_version
    ) values (
      new.id, new.owner_id, '', new.type, new.currency, new.created_at,
      new.updated_at, private.encrypt_payload(jsonb_build_object('name', new.name)), 1
    );
    return new;
  elsif tg_op = 'UPDATE' then
    new.id := old.id;
    update public.encrypted_ledgers
    set owner_id = new.owner_id, type = new.type, currency = new.currency,
        updated_at = coalesce(new.updated_at, now()),
        private_payload = private.encrypt_payload(jsonb_build_object('name', new.name)),
        encryption_key_version = 1
    where id = old.id;
    return new;
  else
    delete from public.encrypted_ledgers where id = old.id;
    return old;
  end if;
end;
$$;

create trigger ledgers_secure_write
instead of insert or update or delete on public.ledgers
for each row execute function private.write_ledgers_view();

create or replace function private.write_ledger_members_view()
returns trigger language plpgsql security definer
set search_path = private, public, pg_catalog as $$
begin
  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid());
    new.role := coalesce(new.role, 'member');
    new.status := coalesce(new.status, 'active');
    new.joined_at := coalesce(new.joined_at, now());
    new.nickname := coalesce(new.nickname, '공동 멤버');
    new.is_default := coalesce(new.is_default, false);
    insert into public.encrypted_ledger_members (
      id, ledger_id, user_id, role, status, joined_at, removed_at, nickname,
      is_default, private_payload, encryption_key_version
    ) values (
      new.id, new.ledger_id, new.user_id, new.role, new.status, new.joined_at,
      new.removed_at, '', new.is_default,
      private.encrypt_payload(jsonb_build_object('nickname', new.nickname)), 1
    );
    return new;
  elsif tg_op = 'UPDATE' then
    new.id := old.id;
    update public.encrypted_ledger_members
    set ledger_id = new.ledger_id, user_id = new.user_id, role = new.role,
        status = new.status, removed_at = new.removed_at,
        is_default = new.is_default,
        private_payload = private.encrypt_payload(jsonb_build_object(
          'nickname', coalesce(new.nickname, '공동 멤버')
        )),
        encryption_key_version = 1
    where id = old.id;
    return new;
  else
    delete from public.encrypted_ledger_members where id = old.id;
    return old;
  end if;
end;
$$;

create trigger ledger_members_secure_write
instead of insert or update or delete on public.ledger_members
for each row execute function private.write_ledger_members_view();

create or replace function private.write_categories_view()
returns trigger language plpgsql security definer
set search_path = private, public, pg_catalog as $$
declare
  category_name text;
begin
  category_name := trim(coalesce(new.name, ''));
  if tg_op <> 'DELETE' and category_name = '' then
    raise exception '카테고리 이름을 입력해 주세요.';
  end if;

  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid());
    new.sort_order := coalesce(new.sort_order, 0);
    new.is_default := coalesce(new.is_default, false);
    new.is_archived := coalesce(new.is_archived, false);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());
    insert into public.encrypted_categories (
      id, ledger_id, created_by, type, name, icon, color, sort_order,
      is_default, is_archived, created_at, updated_at, private_payload,
      name_blind_index, encryption_key_version
    ) values (
      new.id, new.ledger_id, new.created_by, new.type, '', new.icon, new.color,
      new.sort_order, new.is_default, new.is_archived, new.created_at,
      new.updated_at, private.encrypt_payload(jsonb_build_object('name', category_name)),
      private.blind_index(new.ledger_id::text || '|' || new.type || '|' || category_name), 1
    );
    new.name := category_name;
    return new;
  elsif tg_op = 'UPDATE' then
    new.id := old.id;
    update public.encrypted_categories
    set ledger_id = new.ledger_id, created_by = new.created_by, type = new.type,
        icon = new.icon, color = new.color, sort_order = new.sort_order,
        is_default = new.is_default, is_archived = new.is_archived,
        updated_at = coalesce(new.updated_at, now()),
        private_payload = private.encrypt_payload(jsonb_build_object('name', category_name)),
        name_blind_index = private.blind_index(
          new.ledger_id::text || '|' || new.type || '|' || category_name
        ), encryption_key_version = 1
    where id = old.id;
    new.name := category_name;
    return new;
  else
    delete from public.encrypted_categories where id = old.id;
    return old;
  end if;
end;
$$;

create trigger categories_secure_write
instead of insert or update or delete on public.categories
for each row execute function private.write_categories_view();

create or replace function private.write_payment_methods_view()
returns trigger language plpgsql security definer
set search_path = private, public, pg_catalog as $$
declare
  private_data jsonb;
begin
  if tg_op <> 'DELETE' and trim(coalesce(new.name, '')) = '' then
    raise exception '카드 또는 계좌 이름을 입력해 주세요.';
  end if;

  private_data := jsonb_strip_nulls(jsonb_build_object(
    'name', trim(coalesce(new.name, '')), 'last4', new.last4,
    'issuer', new.issuer, 'payment_day', new.payment_day,
    'billing_period_end_day', new.billing_period_end_day,
    'billing_period_end_month_offset', new.billing_period_end_month_offset
  ));

  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid());
    new.visibility := coalesce(new.visibility, 'private');
    new.is_active := coalesce(new.is_active, true);
    new.is_primary := coalesce(new.is_primary, false);
    new.is_debit := coalesce(new.is_debit, false);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());
    insert into public.encrypted_payment_methods (
      id, ledger_id, owner_user_id, name, type, last4, issuer, visibility,
      is_active, created_at, updated_at, payment_day,
      billing_period_end_day, billing_period_end_month_offset, deleted_at,
      is_primary, is_debit, private_payload, encryption_key_version
    ) values (
      new.id, new.ledger_id, new.owner_user_id, '', new.type, null, null,
      new.visibility, new.is_active, new.created_at, new.updated_at, null, null,
      null, new.deleted_at, new.is_primary, new.is_debit,
      private.encrypt_payload(private_data), 1
    );
    return new;
  elsif tg_op = 'UPDATE' then
    new.id := old.id;
    update public.encrypted_payment_methods
    set ledger_id = new.ledger_id, owner_user_id = new.owner_user_id,
        type = new.type, visibility = new.visibility, is_active = new.is_active,
        updated_at = coalesce(new.updated_at, now()), deleted_at = new.deleted_at,
        is_primary = new.is_primary, is_debit = new.is_debit,
        private_payload = private.encrypt_payload(private_data),
        encryption_key_version = 1
    where id = old.id;
    return new;
  else
    delete from public.encrypted_payment_methods where id = old.id;
    return old;
  end if;
end;
$$;

create trigger payment_methods_secure_write
instead of insert or update or delete on public.payment_methods
for each row execute function private.write_payment_methods_view();

create or replace function private.write_transactions_view()
returns trigger language plpgsql security definer
set search_path = private, public, pg_catalog as $$
declare
  private_data jsonb;
begin
  if tg_op = 'DELETE' then
    delete from public.encrypted_transactions where id = old.id;
    return old;
  end if;

  if (tg_op = 'INSERT' or new.payment_method_id is distinct from old.payment_method_id)
    and new.payment_method_id is not null
    and not exists (
      select 1 from public.payment_methods p
      where p.id = new.payment_method_id and p.ledger_id = new.ledger_id
    ) then
    raise exception '사용할 수 없는 결제수단입니다.';
  end if;

  if new.amount is null or new.amount <= 0 then
    raise exception '금액은 0보다 커야 합니다.';
  end if;
  if new.transaction_at is null then
    raise exception '거래 일시가 필요합니다.';
  end if;

  private_data := jsonb_strip_nulls(jsonb_build_object(
    'amount', new.amount, 'transaction_at', new.transaction_at,
    'merchant_name', new.merchant_name, 'memo', new.memo,
    'source_app', new.source_app, 'source_sender', new.source_sender
  ));

  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid());
    new.status := coalesce(new.status, 'confirmed');
    new.currency := coalesce(new.currency, 'KRW');
    new.source_type := coalesce(new.source_type, 'manual');
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());
    insert into public.encrypted_transactions (
      id, ledger_id, created_by, updated_by, type, status, amount, currency,
      transaction_at, category_id, payment_method_id, merchant_name, memo,
      source_type, source_app, source_sender, source_hash, parse_confidence,
      created_at, updated_at, deleted_at, actor_user_id, recurring_rule_id,
      recurring_type, installment_number, installment_total, private_payload,
      encryption_key_version
    ) values (
      new.id, new.ledger_id, new.created_by, new.updated_by, new.type,
      new.status, 0, new.currency, '1970-01-01 00:00:00+00', new.category_id,
      new.payment_method_id, null, null, new.source_type, null, null,
      private.blind_index(new.source_hash), new.parse_confidence,
      new.created_at, new.updated_at, new.deleted_at, new.actor_user_id,
      new.recurring_rule_id, new.recurring_type, new.installment_number,
      new.installment_total, private.encrypt_payload(private_data), 1
    );
    new.source_hash := private.blind_index(new.source_hash);
    return new;
  else
    new.id := old.id;
    update public.encrypted_transactions
    set ledger_id = new.ledger_id, created_by = new.created_by,
        updated_by = new.updated_by, type = new.type, status = new.status,
        currency = new.currency, category_id = new.category_id,
        payment_method_id = new.payment_method_id, source_type = new.source_type,
        source_hash = case
          when new.source_hash is distinct from old.source_hash
            then private.blind_index(new.source_hash)
          else source_hash
        end,
        parse_confidence = new.parse_confidence,
        updated_at = coalesce(new.updated_at, now()), deleted_at = new.deleted_at,
        actor_user_id = new.actor_user_id,
        recurring_rule_id = new.recurring_rule_id,
        recurring_type = new.recurring_type,
        installment_number = new.installment_number,
        installment_total = new.installment_total,
        private_payload = private.encrypt_payload(private_data),
        encryption_key_version = 1
    where id = old.id;
    return new;
  end if;
end;
$$;

create trigger transactions_secure_write
instead of insert or update or delete on public.transactions
for each row execute function private.write_transactions_view();

create or replace function private.write_category_budgets_view()
returns trigger language plpgsql security definer
set search_path = private, public, pg_catalog as $$
declare
  month_index text;
begin
  if tg_op = 'DELETE' then
    delete from public.encrypted_category_budgets where id = old.id;
    return old;
  end if;

  if new.effective_month is null or extract(day from new.effective_month) <> 1 then
    raise exception '예산 적용 월은 매월 1일이어야 합니다.';
  end if;
  if new.amount is null or new.amount < 0 then
    raise exception '예산 금액은 0 이상이어야 합니다.';
  end if;
  month_index := private.blind_index(
    new.category_id::text || '|' || new.effective_month::text
  );

  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid());
    new.created_at := coalesce(new.created_at, now());
    insert into public.encrypted_category_budgets (
      id, ledger_id, category_id, effective_month, amount, created_by,
      created_at, private_payload, effective_month_blind_index,
      encryption_key_version
    ) values (
      new.id, new.ledger_id, new.category_id, '1970-01-01', 0,
      new.created_by, new.created_at,
      private.encrypt_payload(jsonb_build_object(
        'effective_month', new.effective_month, 'amount', new.amount
      )), month_index, 1
    );
    return new;
  else
    new.id := old.id;
    update public.encrypted_category_budgets
    set ledger_id = new.ledger_id, category_id = new.category_id,
        created_by = new.created_by,
        private_payload = private.encrypt_payload(jsonb_build_object(
          'effective_month', new.effective_month, 'amount', new.amount
        )), effective_month_blind_index = month_index,
        encryption_key_version = 1
    where id = old.id;
    return new;
  end if;
end;
$$;

create trigger category_budgets_secure_write
instead of insert or update or delete on public.category_budgets
for each row execute function private.write_category_budgets_view();

create or replace function private.write_recurring_rules_view()
returns trigger language plpgsql security definer
set search_path = private, public, pg_catalog as $$
declare
  private_data jsonb;
begin
  if tg_op = 'DELETE' then
    delete from public.encrypted_recurring_rules where id = old.id;
    return old;
  end if;

  if (tg_op = 'INSERT' or new.payment_method_id is distinct from old.payment_method_id)
    and new.payment_method_id is not null
    and not exists (
      select 1 from public.payment_methods p
      where p.id = new.payment_method_id and p.ledger_id = new.ledger_id
    ) then
    raise exception '사용할 수 없는 결제수단입니다.';
  end if;

  if new.amount is null or new.amount <= 0 then
    raise exception '반복 금액은 0보다 커야 합니다.';
  end if;
  if new.day_of_month is null or new.day_of_month not between 1 and 31 then
    raise exception '반복 일자는 1일부터 31일 사이여야 합니다.';
  end if;
  if new.start_month is null then
    raise exception '반복 시작 월이 필요합니다.';
  end if;

  private_data := jsonb_strip_nulls(jsonb_build_object(
    'amount', new.amount, 'day_of_month', new.day_of_month,
    'time_of_day', coalesce(new.time_of_day, '12:00'::time),
    'start_month', new.start_month, 'end_month', new.end_month,
    'inactive_from_month', new.inactive_from_month,
    'installment_months', new.installment_months,
    'merchant_name', new.merchant_name, 'memo', new.memo,
    'purchase_at', new.purchase_at,
    'installment_principal', new.installment_principal
  ));

  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid());
    new.time_of_day := coalesce(new.time_of_day, '12:00'::time);
    new.is_active := coalesce(new.is_active, true);
    new.transaction_type := coalesce(new.transaction_type, 'expense');
    new.transaction_status := coalesce(new.transaction_status, 'confirmed');
    new.installment_amount_type := coalesce(new.installment_amount_type, 'monthly');
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());
    insert into public.encrypted_recurring_rules (
      id, ledger_id, created_by, rule_type, amount, day_of_month, time_of_day,
      start_month, end_month, inactive_from_month, installment_months,
      category_id, merchant_name, memo, is_active, created_at, updated_at,
      transaction_type, transaction_status, actor_user_id, purchase_at,
      payment_method_id, installment_amount_type, installment_principal,
      private_payload, encryption_key_version
    ) values (
      new.id, new.ledger_id, new.created_by, new.rule_type, 1, 1, '00:00',
      '1970-01-01', null, null, null, new.category_id, null, null,
      new.is_active, new.created_at, new.updated_at, new.transaction_type,
      new.transaction_status, new.actor_user_id, null, new.payment_method_id,
      new.installment_amount_type, null, private.encrypt_payload(private_data), 1
    );
    return new;
  else
    new.id := old.id;
    update public.encrypted_recurring_rules
    set ledger_id = new.ledger_id, created_by = new.created_by,
        rule_type = new.rule_type, category_id = new.category_id,
        is_active = new.is_active, updated_at = coalesce(new.updated_at, now()),
        transaction_type = new.transaction_type,
        transaction_status = new.transaction_status,
        actor_user_id = new.actor_user_id,
        payment_method_id = new.payment_method_id,
        installment_amount_type = new.installment_amount_type,
        private_payload = private.encrypt_payload(private_data),
        encryption_key_version = 1
    where id = old.id;
    return new;
  end if;
end;
$$;

create trigger recurring_rules_secure_write
instead of insert or update or delete on public.recurring_rules
for each row execute function private.write_recurring_rules_view();

create or replace function private.write_notification_rules_view()
returns trigger language plpgsql security definer
set search_path = private, public, pg_catalog as $$
begin
  if tg_op = 'DELETE' then
    delete from public.encrypted_notification_rules where id = old.id;
    return old;
  end if;

  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid());
    new.is_enabled := coalesce(new.is_enabled, true);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());
    insert into public.encrypted_notification_rules (
      id, user_id, ledger_id, app_package, app_label, sender_filter,
      is_enabled, created_at, updated_at, private_payload,
      encryption_key_version
    ) values (
      new.id, new.user_id, new.ledger_id, '', null, null, new.is_enabled,
      new.created_at, new.updated_at,
      private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
        'app_package', new.app_package, 'app_label', new.app_label,
        'sender_filter', new.sender_filter
      ))), 1
    );
    return new;
  else
    new.id := old.id;
    update public.encrypted_notification_rules
    set user_id = new.user_id, ledger_id = new.ledger_id,
        is_enabled = new.is_enabled, updated_at = coalesce(new.updated_at, now()),
        private_payload = private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
          'app_package', new.app_package, 'app_label', new.app_label,
          'sender_filter', new.sender_filter
        ))), encryption_key_version = 1
    where id = old.id;
    return new;
  end if;
end;
$$;

create trigger notification_rules_secure_write
instead of insert or update or delete on public.notification_rules
for each row execute function private.write_notification_rules_view();

create or replace function private.write_card_message_samples_view()
returns trigger language plpgsql security definer
set search_path = private, public, pg_catalog as $$
begin
  if tg_op = 'DELETE' then
    delete from public.encrypted_card_message_samples where id = old.id;
    return old;
  end if;

  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid());
    new.status := coalesce(new.status, 'submitted');
    new.created_at := coalesce(new.created_at, now());
    insert into public.encrypted_card_message_samples (
      id, submitted_by, card_company_name, masked_message, expected_amount,
      expected_merchant_name, expected_transaction_at, parse_result,
      consent_version, status, created_at, reviewed_at, reviewed_by,
      private_payload, encryption_key_version
    ) values (
      new.id, new.submitted_by, null, '', null, null, null, null,
      new.consent_version, new.status, new.created_at, new.reviewed_at,
      new.reviewed_by,
      private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
        'card_company_name', new.card_company_name,
        'masked_message', new.masked_message,
        'expected_amount', new.expected_amount,
        'expected_merchant_name', new.expected_merchant_name,
        'expected_transaction_at', new.expected_transaction_at,
        'parse_result', new.parse_result
      ))), 1
    );
    return new;
  else
    new.id := old.id;
    update public.encrypted_card_message_samples
    set submitted_by = new.submitted_by, consent_version = new.consent_version,
        status = new.status, reviewed_at = new.reviewed_at,
        reviewed_by = new.reviewed_by,
        private_payload = private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
          'card_company_name', new.card_company_name,
          'masked_message', new.masked_message,
          'expected_amount', new.expected_amount,
          'expected_merchant_name', new.expected_merchant_name,
          'expected_transaction_at', new.expected_transaction_at,
          'parse_result', new.parse_result
        ))), encryption_key_version = 1
    where id = old.id;
    return new;
  end if;
end;
$$;

create trigger card_message_samples_secure_write
instead of insert or update or delete on public.card_message_samples
for each row execute function private.write_card_message_samples_view();

grant select, insert, update, delete on
  public.encrypted_profiles,
  public.encrypted_ledgers,
  public.encrypted_ledger_members,
  public.encrypted_categories,
  public.encrypted_payment_methods,
  public.encrypted_transactions,
  public.encrypted_category_budgets,
  public.encrypted_recurring_rules,
  public.encrypted_notification_rules,
  public.encrypted_card_message_samples
to salimon_crypto_writer;

revoke insert, update, delete on
  public.encrypted_profiles,
  public.encrypted_ledgers,
  public.encrypted_ledger_members,
  public.encrypted_categories,
  public.encrypted_payment_methods,
  public.encrypted_transactions,
  public.encrypted_category_budgets,
  public.encrypted_recurring_rules,
  public.encrypted_notification_rules,
  public.encrypted_card_message_samples
from anon, authenticated;

alter function private.write_profiles_view() owner to salimon_crypto_writer;
alter function private.write_ledgers_view() owner to salimon_crypto_writer;
alter function private.write_ledger_members_view() owner to salimon_crypto_writer;
alter function private.write_categories_view() owner to salimon_crypto_writer;
alter function private.write_payment_methods_view() owner to salimon_crypto_writer;
alter function private.write_transactions_view() owner to salimon_crypto_writer;
alter function private.write_category_budgets_view() owner to salimon_crypto_writer;
alter function private.write_recurring_rules_view() owner to salimon_crypto_writer;
alter function private.write_notification_rules_view() owner to salimon_crypto_writer;
alter function private.write_card_message_samples_view() owner to salimon_crypto_writer;

revoke all on function private.write_profiles_view() from public;
revoke all on function private.write_ledgers_view() from public;
revoke all on function private.write_ledger_members_view() from public;
revoke all on function private.write_categories_view() from public;
revoke all on function private.write_payment_methods_view() from public;
revoke all on function private.write_transactions_view() from public;
revoke all on function private.write_category_budgets_view() from public;
revoke all on function private.write_recurring_rules_view() from public;
revoke all on function private.write_notification_rules_view() from public;
revoke all on function private.write_card_message_samples_view() from public;
