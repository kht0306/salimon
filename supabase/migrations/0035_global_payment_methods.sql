-- Payment instruments belong to a user. Ledger payment methods are only links
-- between an instrument and a ledger. Existing link ids are deliberately kept
-- so transaction and recurring-rule history remains intact.

drop trigger if exists encrypted_payment_methods_personal_privacy
on public.encrypted_payment_methods;

alter table public.encrypted_payment_methods
  rename to encrypted_ledger_payment_methods;

drop policy if exists "payment_methods_select_by_visibility"
  on public.encrypted_ledger_payment_methods;
drop policy if exists "payment_methods_insert_by_visibility"
  on public.encrypted_ledger_payment_methods;
drop policy if exists "payment_methods_update_by_visibility"
  on public.encrypted_ledger_payment_methods;
drop policy if exists "payment_methods_delete_by_visibility"
  on public.encrypted_ledger_payment_methods;

create table public.encrypted_user_payment_methods (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('cash', 'card', 'bank', 'pay', 'etc')),
  name text not null default '',
  last4 text,
  issuer text,
  payment_day int,
  billing_period_end_day int,
  billing_period_end_month_offset int,
  is_debit boolean not null default false,
  is_active boolean not null default true,
  deleted_at timestamptz,
  identity_blind_index text,
  private_payload bytea not null,
  encryption_key_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.encrypted_user_payment_methods enable row level security;

alter table public.encrypted_ledger_payment_methods
  add column payment_instrument_id uuid;

create temporary table payment_method_migration_map
on commit drop
as
with source as (
  select
    p.id as link_id,
    coalesce(p.owner_user_id, ledger.owner_id) as owner_user_id,
    p.type,
    nullif(private.decrypt_payload(p.private_payload) ->> 'last4', '') as last4,
    p.is_active,
    p.deleted_at,
    p.updated_at,
    p.created_at
  from public.encrypted_ledger_payment_methods p
  join public.encrypted_ledgers ledger on ledger.id = p.ledger_id
), ranked as (
  select
    source.*,
    first_value(link_id) over (
      partition by owner_user_id, type,
        case when last4 is null then link_id::text else last4 end
      order by updated_at desc, created_at desc, link_id
    ) as instrument_id,
    row_number() over (
      partition by owner_user_id, type,
        case when last4 is null then link_id::text else last4 end
      order by updated_at desc, created_at desc, link_id
    ) as rank_number,
    bool_or(is_active and deleted_at is null) over (
      partition by owner_user_id, type,
        case when last4 is null then link_id::text else last4 end
    ) as any_active,
    min(created_at) over (
      partition by owner_user_id, type,
        case when last4 is null then link_id::text else last4 end
    ) as first_created_at,
    max(updated_at) over (
      partition by owner_user_id, type,
        case when last4 is null then link_id::text else last4 end
    ) as last_updated_at
  from source
)
select * from ranked;

insert into public.encrypted_user_payment_methods (
  id, owner_user_id, type, is_debit, is_active, deleted_at,
  identity_blind_index, private_payload, encryption_key_version,
  created_at, updated_at
)
select
  m.instrument_id,
  m.owner_user_id,
  m.type,
  p.is_debit,
  m.any_active,
  case when m.any_active then null else p.deleted_at end,
  case
    when m.last4 is null then null
    else private.blind_index(
      m.owner_user_id::text || '|' || m.type || '|' || m.last4
    )
  end,
  p.private_payload,
  p.encryption_key_version,
  m.first_created_at,
  m.last_updated_at
from payment_method_migration_map m
join public.encrypted_ledger_payment_methods p on p.id = m.link_id
where m.rank_number = 1;

update public.encrypted_ledger_payment_methods link
set payment_instrument_id = map.instrument_id,
    private_payload = private.encrypt_payload('{}'::jsonb),
    encryption_key_version = 1
from payment_method_migration_map map
where map.link_id = link.id;

alter table public.encrypted_ledger_payment_methods
  alter column payment_instrument_id set not null,
  add constraint encrypted_ledger_payment_methods_instrument_fkey
    foreign key (payment_instrument_id)
    references public.encrypted_user_payment_methods(id) on delete restrict;

create index encrypted_ledger_payment_methods_instrument_idx
on public.encrypted_ledger_payment_methods (payment_instrument_id);

create unique index encrypted_ledger_payment_methods_ledger_instrument_uidx
on public.encrypted_ledger_payment_methods (ledger_id, payment_instrument_id)
where deleted_at is null;

create unique index encrypted_user_payment_methods_identity_uidx
on public.encrypted_user_payment_methods (identity_blind_index)
where identity_blind_index is not null and deleted_at is null;

create or replace view public.payment_methods
with (security_invoker = true)
as
select
  link.id,
  link.ledger_id,
  instrument.owner_user_id,
  data.payload ->> 'name' as name,
  instrument.type,
  data.payload ->> 'last4' as last4,
  data.payload ->> 'issuer' as issuer,
  link.visibility,
  link.is_active and instrument.is_active as is_active,
  link.created_at,
  greatest(link.updated_at, instrument.updated_at) as updated_at,
  (data.payload ->> 'payment_day')::int as payment_day,
  (data.payload ->> 'billing_period_end_day')::int as billing_period_end_day,
  (data.payload ->> 'billing_period_end_month_offset')::int
    as billing_period_end_month_offset,
  link.deleted_at,
  link.is_primary,
  instrument.is_debit,
  instrument.id as payment_instrument_id
from public.encrypted_ledger_payment_methods link
join public.encrypted_user_payment_methods instrument
  on instrument.id = link.payment_instrument_id
cross join lateral (
  select private.decrypt_payload(instrument.private_payload) as payload
) data;

create policy "user_payment_methods_select_owner_or_shared"
on public.encrypted_user_payment_methods for select to authenticated
using (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.encrypted_ledger_payment_methods link
    where link.payment_instrument_id = id
      and link.visibility = 'ledger'
      and link.deleted_at is null
      and public.is_ledger_member(link.ledger_id)
  )
);

create policy "ledger_payment_methods_select_owner_or_shared"
on public.encrypted_ledger_payment_methods for select to authenticated
using (
  owner_user_id = auth.uid()
  or (
    visibility = 'ledger'
    and public.is_ledger_member(ledger_id)
  )
);

create policy "ledger_payment_methods_write_member"
on public.encrypted_ledger_payment_methods for all to salimon_crypto_writer
using (
  public.has_ledger_role(ledger_id, array['owner', 'admin', 'member'])
  and (owner_user_id = auth.uid() or visibility = 'ledger')
)
with check (
  public.has_ledger_role(ledger_id, array['owner', 'admin', 'member'])
  and (owner_user_id = auth.uid() or visibility = 'ledger')
);

create policy "user_payment_methods_write_owner"
on public.encrypted_user_payment_methods for all to salimon_crypto_writer
using (owner_user_id = auth.uid())
with check (auth.uid() is not null);

grant select, insert, update, delete
on public.encrypted_user_payment_methods to salimon_crypto_writer;
revoke insert, update, delete
on public.encrypted_user_payment_methods from anon, authenticated;

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
  if tg_op = 'DELETE' then
    delete from public.encrypted_ledger_payment_methods where id = old.id;
    return old;
  end if;

  if trim(coalesce(new.name, '')) = '' then
    raise exception '카드 또는 계좌 이름을 입력해 주세요.';
  end if;
  if new.type not in ('card', 'bank') then
    raise exception '카드 또는 계좌만 등록할 수 있습니다.';
  end if;

  target_owner := coalesce(new.owner_user_id, auth.uid());
  if target_owner is null then raise exception '로그인이 필요합니다.'; end if;
  if not public.has_ledger_role(
    new.ledger_id, array['owner', 'admin', 'member']
  ) then
    raise exception '이 가계부에 결제수단을 등록할 권한이 없습니다.';
  end if;
  if not exists (
    select 1 from public.encrypted_ledger_members member
    where member.ledger_id = new.ledger_id
      and member.user_id = target_owner
      and member.status = 'active'
  ) then
    raise exception '가계부에 참여 중인 사용자만 소유자로 지정할 수 있습니다.';
  end if;

  select type into target_ledger_type
  from public.encrypted_ledgers where id = new.ledger_id;
  new.visibility := case
    when target_ledger_type = 'personal' then 'private'
    else coalesce(new.visibility, 'private')
  end;
  if target_owner <> auth.uid() then new.visibility := 'ledger'; end if;

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
  if old.owner_user_id <> auth.uid() then
    raise exception '결제수단 소유자만 정보를 변경할 수 있습니다.';
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

-- Creation can connect existing user-owned instruments. Selected instruments
-- default to private unless their id is also present in the visible list.
drop function if exists public.create_ledger(text, text, boolean);
create function public.create_ledger(
  p_name text,
  p_type text,
  p_set_default boolean default false,
  p_payment_instrument_ids uuid[] default array[]::uuid[],
  p_ledger_visible_instrument_ids uuid[] default array[]::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  new_ledger_id uuid;
  display_name text;
  normalized_name text;
  should_set_default boolean;
  instrument record;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  normalized_name := trim(coalesce(p_name, ''));
  if normalized_name = '' then raise exception '가계부 이름을 입력해 주세요.'; end if;
  if char_length(normalized_name) > 30 then
    raise exception '가계부 이름은 30자 이내로 입력해 주세요.';
  end if;
  if normalized_name ~ '[[:cntrl:]]' then
    raise exception '가계부 이름에 사용할 수 없는 문자가 포함되어 있습니다.';
  end if;
  if p_type is null or p_type not in ('personal', 'shared') then
    raise exception '가계부 유형을 확인해 주세요.';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_payment_instrument_ids, array[]::uuid[])) id
    where not exists (
      select 1 from public.encrypted_user_payment_methods method
      where method.id = id and method.owner_user_id = auth.uid()
        and method.deleted_at is null
    )
  ) then
    raise exception '연결할 수 없는 카드 또는 계좌가 포함되어 있습니다.';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_ledger_visible_instrument_ids, array[]::uuid[])) id
    where not id = any(coalesce(p_payment_instrument_ids, array[]::uuid[]))
  ) then
    raise exception '공개할 결제수단은 먼저 가계부에 연결해야 합니다.';
  end if;

  select nickname into display_name from public.profiles where id = auth.uid();
  should_set_default := p_set_default or not exists (
    select 1 from public.ledger_members
    where user_id = auth.uid() and status = 'active' and is_default
  );
  if should_set_default then
    update public.ledger_members set is_default = false
    where user_id = auth.uid() and status = 'active' and is_default;
  end if;

  insert into public.ledgers (owner_id, name, type, currency)
  values (auth.uid(), normalized_name, p_type, 'KRW')
  returning id into new_ledger_id;
  insert into public.ledger_members (
    ledger_id, user_id, nickname, role, status, is_default
  ) values (
    new_ledger_id, auth.uid(), coalesce(display_name, '살림온 사용자'),
    'owner', 'active', should_set_default
  );
  insert into public.categories (
    ledger_id, created_by, type, name, icon, color, sort_order, is_default
  ) values
    (new_ledger_id, auth.uid(), 'expense', '식비', 'utensils', '#E4572E', 0, true),
    (new_ledger_id, auth.uid(), 'expense', '카페/간식', 'coffee', '#F3A712', 1, true),
    (new_ledger_id, auth.uid(), 'expense', '교통', 'bus', '#2D6A4F', 2, true),
    (new_ledger_id, auth.uid(), 'expense', '생활', 'shopping-basket', '#0F8B8D', 3, true),
    (new_ledger_id, auth.uid(), 'expense', '기타', 'ellipsis', '#6B746D', 4, true),
    (new_ledger_id, auth.uid(), 'income', '급여', 'wallet-cards', '#2D6A4F', 5, true),
    (new_ledger_id, auth.uid(), 'income', '기타 수입', 'circle-plus', '#0F8B8D', 6, true);
  update public.categories set sort_order = sort_order + 7
  where ledger_id = new_ledger_id and type = 'saving';

  for instrument in
    select method.*
    from public.encrypted_user_payment_methods method
    where method.id = any(coalesce(p_payment_instrument_ids, array[]::uuid[]))
  loop
    insert into public.encrypted_ledger_payment_methods (
      ledger_id, payment_instrument_id, owner_user_id, name, type, visibility,
      is_active, is_primary, is_debit, private_payload, encryption_key_version
    ) values (
      new_ledger_id, instrument.id, instrument.owner_user_id, '', instrument.type,
      case
        when p_type = 'personal' then 'private'
        when instrument.id = any(coalesce(
          p_ledger_visible_instrument_ids, array[]::uuid[]
        )) then 'ledger'
        else 'private'
      end,
      true, false, instrument.is_debit,
      private.encrypt_payload('{}'::jsonb), 1
    );
  end loop;
  return new_ledger_id;
end;
$$;

revoke all on function public.create_ledger(
  text, text, boolean, uuid[], uuid[]
) from public;
grant execute on function public.create_ledger(
  text, text, boolean, uuid[], uuid[]
) to authenticated;

create or replace function public.create_shared_ledger(ledger_name text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return public.create_ledger(
    ledger_name, 'shared', false, array[]::uuid[], array[]::uuid[]
  );
end;
$$;

-- Personal-to-shared conversion only changes ledger-link visibility. The
-- user-owned instrument itself is never moved or exposed globally.
create or replace function public.convert_personal_ledger_to_shared(
  p_ledger_id uuid,
  p_shared_payment_method_ids uuid[] default array[]::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (
    select 1 from public.ledgers
    where id = p_ledger_id and owner_id = auth.uid() and type = 'personal'
  ) then
    raise exception '소유한 개인 가계부만 공동으로 전환할 수 있습니다.';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_shared_payment_method_ids, array[]::uuid[])) id
    where not exists (
      select 1 from public.payment_methods method
      where method.id = id and method.ledger_id = p_ledger_id
        and method.owner_user_id = auth.uid()
    )
  ) then
    raise exception '공개할 수 없는 카드 또는 계좌가 포함되어 있습니다.';
  end if;
  update public.encrypted_ledger_payment_methods
  set visibility = case
    when id = any(coalesce(p_shared_payment_method_ids, array[]::uuid[]))
      then 'ledger'
    else 'private'
  end,
  updated_at = now()
  where ledger_id = p_ledger_id and owner_user_id = auth.uid();
  update public.ledgers set type = 'shared', updated_at = now()
  where id = p_ledger_id;
end;
$$;

revoke all on function public.convert_personal_ledger_to_shared(uuid, uuid[])
from public;
grant execute on function public.convert_personal_ledger_to_shared(uuid, uuid[])
to authenticated;
