-- Optional subcategories, encrypted transaction tags, and category splits are
-- collaboration aids. The parent transaction remains the settlement unit.

alter table public.encrypted_categories
  add column parent_category_id uuid
  references public.encrypted_categories(id) on delete set null;

create index encrypted_categories_parent_idx
on public.encrypted_categories (parent_category_id)
where parent_category_id is not null;

create or replace view public.categories
with (security_invoker = true)
as
select
  category.id,
  category.ledger_id,
  category.created_by,
  category.type,
  data.payload ->> 'name' as name,
  category.icon,
  category.color,
  category.sort_order,
  category.is_default,
  category.is_archived,
  category.created_at,
  category.updated_at,
  category.parent_category_id
from public.encrypted_categories category
cross join lateral (
  select private.decrypt_payload(category.private_payload) as payload
) data;

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
  if tg_op <> 'DELETE' and new.parent_category_id is not null and not exists (
    select 1 from public.encrypted_categories parent
    where parent.id = new.parent_category_id
      and parent.ledger_id = new.ledger_id
      and parent.parent_category_id is null
      and parent.is_archived = false
  ) then
    raise exception '상위 카테고리를 확인해 주세요.';
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
      name_blind_index, encryption_key_version, parent_category_id
    ) values (
      new.id, new.ledger_id, new.created_by, new.type, '', new.icon, new.color,
      new.sort_order, new.is_default, new.is_archived, new.created_at,
      new.updated_at, private.encrypt_payload(jsonb_build_object('name', category_name)),
      private.blind_index(new.ledger_id::text || '|' || new.type || '|' || category_name),
      1, new.parent_category_id
    );
    new.name := category_name;
    return new;
  elsif tg_op = 'UPDATE' then
    new.id := old.id;
    if new.parent_category_id = new.id then
      raise exception '카테고리를 자기 자신의 하위로 지정할 수 없습니다.';
    end if;
    update public.encrypted_categories
    set ledger_id = new.ledger_id, created_by = new.created_by, type = new.type,
        icon = new.icon, color = new.color, sort_order = new.sort_order,
        is_default = new.is_default, is_archived = new.is_archived,
        parent_category_id = new.parent_category_id,
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

alter function private.write_categories_view() owner to salimon_crypto_writer;

create or replace view public.transactions
with (security_invoker = true)
as
select
  transaction.id,
  transaction.ledger_id,
  transaction.created_by,
  transaction.updated_by,
  transaction.type,
  transaction.status,
  (data.payload ->> 'amount')::numeric as amount,
  transaction.currency,
  (data.payload ->> 'transaction_at')::timestamptz as transaction_at,
  transaction.category_id,
  transaction.payment_method_id,
  data.payload ->> 'merchant_name' as merchant_name,
  data.payload ->> 'memo' as memo,
  transaction.source_type,
  data.payload ->> 'source_app' as source_app,
  data.payload ->> 'source_sender' as source_sender,
  transaction.source_hash,
  transaction.parse_confidence,
  transaction.created_at,
  transaction.updated_at,
  transaction.deleted_at,
  transaction.actor_user_id,
  transaction.recurring_rule_id,
  transaction.recurring_type,
  transaction.installment_number,
  transaction.installment_total,
  coalesce(
    array(
      select jsonb_array_elements_text(
        coalesce(data.payload -> 'tags', '[]'::jsonb)
      )
    ),
    array[]::text[]
  ) as tags
from public.encrypted_transactions transaction
cross join lateral (
  select private.decrypt_payload(transaction.private_payload) as payload
) data;

create or replace function private.write_transactions_view()
returns trigger language plpgsql security definer
set search_path = private, public, pg_catalog as $$
declare
  private_data jsonb;
  normalized_tags text[];
begin
  if tg_op = 'DELETE' then
    delete from public.encrypted_transactions where id = old.id;
    return old;
  end if;

  if (tg_op = 'INSERT' or new.payment_method_id is distinct from old.payment_method_id)
    and new.payment_method_id is not null
    and not exists (
      select 1 from public.payment_methods method
      where method.id = new.payment_method_id and method.ledger_id = new.ledger_id
    ) then
    raise exception '사용할 수 없는 결제수단입니다.';
  end if;
  if new.amount is null or new.amount <= 0 then
    raise exception '금액은 0보다 커야 합니다.';
  end if;
  if new.transaction_at is null then
    raise exception '거래 일시가 필요합니다.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(new.tags, array[]::text[])) tag
    where char_length(trim(tag)) > 20
  ) then
    raise exception '태그는 20자 이내로 입력해 주세요.';
  end if;
  select coalesce(array_agg(distinct trim(tag)), array[]::text[])
  into normalized_tags
  from unnest(coalesce(new.tags, array[]::text[])) tag
  where trim(tag) <> '' and char_length(trim(tag)) <= 20;
  if cardinality(normalized_tags) > 10 then
    raise exception '태그는 최대 10개까지 저장할 수 있습니다.';
  end if;

  private_data := jsonb_strip_nulls(jsonb_build_object(
    'amount', new.amount, 'transaction_at', new.transaction_at,
    'merchant_name', new.merchant_name, 'memo', new.memo,
    'source_app', new.source_app, 'source_sender', new.source_sender,
    'tags', to_jsonb(normalized_tags)
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
    new.tags := normalized_tags;
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
    new.tags := normalized_tags;
    return new;
  end if;
end;
$$;

alter function private.write_transactions_view() owner to salimon_crypto_writer;

create table public.encrypted_transaction_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.encrypted_transactions(id) on delete cascade,
  category_id uuid not null references public.encrypted_categories(id),
  amount numeric(14, 2) not null default 0,
  private_payload bytea not null,
  encryption_key_version smallint not null default 1,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (transaction_id, category_id)
);

alter table public.encrypted_transaction_splits enable row level security;

create policy "transaction_splits_select_member"
on public.encrypted_transaction_splits for select to authenticated
using (exists (
  select 1 from public.encrypted_transactions transaction
  where transaction.id = transaction_id
    and public.is_ledger_member(transaction.ledger_id)
));

grant select on public.encrypted_transaction_splits to authenticated;
grant select, insert, update, delete on public.encrypted_transaction_splits
to salimon_crypto_writer;

create view public.transaction_splits
with (security_invoker = true)
as
select
  split.id,
  split.transaction_id,
  split.category_id,
  (private.decrypt_payload(split.private_payload) ->> 'amount')::numeric as amount,
  split.sort_order,
  split.created_at
from public.encrypted_transaction_splits split;

grant select on public.transaction_splits to authenticated;

create or replace function public.replace_transaction_splits(
  p_transaction_id uuid,
  p_splits jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  parent_transaction public.transactions%rowtype;
  split_item jsonb;
  split_total numeric(14, 2) := 0;
  split_count int := jsonb_array_length(coalesce(p_splits, '[]'::jsonb));
  split_category_id uuid;
  split_amount numeric(14, 2);
  item_index int := 0;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  select * into parent_transaction
  from public.transactions
  where id = p_transaction_id and deleted_at is null;
  if parent_transaction.id is null or not public.has_ledger_role(
    parent_transaction.ledger_id, array['owner', 'admin', 'member']
  ) then
    raise exception '거래 분할을 저장할 권한이 없습니다.';
  end if;
  if parent_transaction.recurring_type is not null and split_count > 0 then
    raise exception '반복 거래는 카테고리를 분할할 수 없습니다.';
  end if;
  if split_count > 10 then
    raise exception '거래는 최대 10개 항목으로 분할할 수 있습니다.';
  end if;

  for split_item in select * from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb))
  loop
    split_category_id := (split_item ->> 'categoryId')::uuid;
    split_amount := (split_item ->> 'amount')::numeric;
    if split_amount <= 0 or not exists (
      select 1 from public.encrypted_categories category
      join public.category_usage_types usage
        on usage.category_id = category.id
      where category.id = split_category_id
        and category.ledger_id = parent_transaction.ledger_id
        and category.is_archived = false
        and usage.usage_type = parent_transaction.type
    ) then
      raise exception '분할 카테고리와 금액을 확인해 주세요.';
    end if;
    split_total := split_total + split_amount;
  end loop;
  if split_count > 0 and split_total <> parent_transaction.amount then
    raise exception '분할 금액의 합계가 거래 금액과 같아야 합니다.';
  end if;

  delete from public.encrypted_transaction_splits
  where transaction_id = p_transaction_id;
  for split_item in select * from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb))
  loop
    split_category_id := (split_item ->> 'categoryId')::uuid;
    split_amount := (split_item ->> 'amount')::numeric;
    insert into public.encrypted_transaction_splits (
      transaction_id, category_id, amount, private_payload,
      encryption_key_version, sort_order
    ) values (
      p_transaction_id, split_category_id, 0,
      private.encrypt_payload(jsonb_build_object('amount', split_amount)),
      1, item_index
    );
    item_index := item_index + 1;
  end loop;
end;
$$;

revoke all on function public.replace_transaction_splits(uuid, jsonb)
from public;
grant execute on function public.replace_transaction_splits(uuid, jsonb)
to authenticated;
