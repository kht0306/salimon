-- Preserve the original split feature across expense, income, and saving
-- transactions while still requiring the protected split base category.

insert into public.category_usage_types (category_id, usage_type)
select category.id, usage.usage_type
from public.encrypted_categories category
cross join (
  values ('expense'), ('income'), ('saving')
) as usage(usage_type)
where category.type = 'expense'
  and category.is_default
  and not category.is_archived
  and private.decrypt_payload(category.private_payload) ->> 'name' = '분할'
on conflict do nothing;

create or replace function public.seed_split_category()
returns trigger
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  split_category_id uuid;
begin
  insert into public.categories (
    ledger_id, created_by, type, name, icon, color, sort_order, is_default
  ) values (
    new.id, new.owner_id, 'expense', '분할', 'list-tree', '#d99a24', 7, true
  )
  on conflict do nothing
  returning id into split_category_id;

  if split_category_id is null then
    select category.id
    into split_category_id
    from public.encrypted_categories category
    where category.ledger_id = new.id
      and category.type = 'expense'
      and category.is_default
      and not category.is_archived
      and private.decrypt_payload(category.private_payload) ->> 'name' = '분할'
    limit 1;
  end if;

  insert into public.category_usage_types (category_id, usage_type)
  select split_category_id, usage.usage_type
  from (
    values ('expense'), ('income'), ('saving')
  ) as usage(usage_type)
  on conflict do nothing;

  return new;
end;
$$;

create or replace function private.protect_split_category_usage()
returns trigger
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
declare
  category_ledger_id uuid;
begin
  select category.ledger_id
  into category_ledger_id
  from public.encrypted_categories category
  where category.id = old.category_id
    and category.is_default
    and category.type = 'expense'
    and private.decrypt_payload(category.private_payload) ->> 'name' = '분할';

  if category_ledger_id is not null
    and exists (
      select 1 from public.encrypted_ledgers ledger
      where ledger.id = category_ledger_id
    )
  then
    raise exception '분할 카테고리의 기본 용도는 제거할 수 없습니다.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

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
  if split_count > 0 and not exists (
    select 1
    from public.encrypted_categories category
    join public.category_usage_types usage
      on usage.category_id = category.id
    where category.id = parent_transaction.category_id
      and category.ledger_id = parent_transaction.ledger_id
      and category.type = 'expense'
      and category.is_default
      and not category.is_archived
      and usage.usage_type = parent_transaction.type
      and private.decrypt_payload(category.private_payload) ->> 'name' = '분할'
  ) then
    raise exception '기준 카테고리에서 분할을 선택해 주세요.';
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
        and not (
          category.is_default
          and category.type = 'expense'
          and private.decrypt_payload(category.private_payload) ->> 'name' = '분할'
        )
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
