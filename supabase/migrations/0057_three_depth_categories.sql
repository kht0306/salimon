-- Extend the existing parent relationship to three category depths while
-- keeping current category ids and finance references unchanged.

drop index if exists public.categories_ledger_type_name_secure_uidx;
drop index if exists public.categories_default_slot_uidx;

update public.encrypted_categories category
set name_blind_index = private.blind_index(
  category.ledger_id::text
  || '|'
  || coalesce(category.parent_category_id::text, 'root')
  || '|'
  || (private.decrypt_payload(category.private_payload) ->> 'name')
);

create unique index categories_parent_name_secure_uidx
on public.encrypted_categories (name_blind_index)
where is_archived = false;

create unique index categories_default_sibling_slot_uidx
on public.encrypted_categories (
  ledger_id,
  type,
  coalesce(parent_category_id, '00000000-0000-0000-0000-000000000000'::uuid),
  sort_order
)
where is_default and not is_archived;

grant select on public.category_usage_types to salimon_crypto_writer;

create or replace function private.validate_category_parent(
  p_category_id uuid,
  p_ledger_id uuid,
  p_parent_category_id uuid
)
returns void
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
declare
  parent_depth int;
  subtree_height int := 1;
  has_cycle boolean := false;
begin
  if p_parent_category_id is null then
    return;
  end if;

  if p_parent_category_id = p_category_id then
    raise exception '카테고리를 자기 자신의 하위로 지정할 수 없습니다.';
  end if;

  if not exists (
    select 1
    from public.encrypted_categories parent
    where parent.id = p_parent_category_id
      and parent.ledger_id = p_ledger_id
      and not parent.is_archived
      and not (
        parent.is_default
        and parent.type = 'expense'
        and private.decrypt_payload(parent.private_payload) ->> 'name' = '분할'
      )
  ) then
    raise exception '상위 카테고리를 확인해 주세요.';
  end if;

  if exists (
    with recursive descendants as (
      select child.id
      from public.encrypted_categories child
      where child.parent_category_id = p_category_id
      union all
      select child.id
      from public.encrypted_categories child
      join descendants parent on parent.id = child.parent_category_id
    )
    select 1
    from descendants
    where id = p_parent_category_id
  ) then
    raise exception '하위 카테고리를 상위 카테고리로 지정할 수 없습니다.';
  end if;

  with recursive ancestors as (
    select
      category.id,
      category.parent_category_id,
      1 as depth,
      array[category.id] as path,
      false as cycle
    from public.encrypted_categories category
    where category.id = p_parent_category_id

    union all

    select
      parent.id,
      parent.parent_category_id,
      ancestor.depth + 1,
      ancestor.path || parent.id,
      parent.id = any(ancestor.path)
    from ancestors ancestor
    join public.encrypted_categories parent
      on parent.id = ancestor.parent_category_id
    where not ancestor.cycle
  )
  select max(depth), coalesce(bool_or(cycle), false)
  into parent_depth, has_cycle
  from ancestors;

  if has_cycle then
    raise exception '카테고리 계층에 순환 관계가 있습니다.';
  end if;

  if parent_depth is null or parent_depth >= 3 then
    raise exception '카테고리는 최대 3단계까지 만들 수 있습니다.';
  end if;

  if exists (
    select 1
    from public.encrypted_categories category
    where category.id = p_category_id
  ) then
    with recursive subtree as (
      select p_category_id as id, 1 as relative_depth
      union all
      select child.id, parent.relative_depth + 1
      from subtree parent
      join public.encrypted_categories child
        on child.parent_category_id = parent.id
    )
    select coalesce(max(relative_depth), 1)
    into subtree_height
    from subtree;
  end if;

  if parent_depth + subtree_height > 3 then
    raise exception '이동 후 카테고리 단계가 3단계를 초과합니다.';
  end if;
end;
$$;

alter function private.validate_category_parent(uuid, uuid, uuid)
owner to salimon_crypto_writer;
revoke all on function private.validate_category_parent(uuid, uuid, uuid)
from public;

create or replace function private.write_categories_view()
returns trigger
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
declare
  category_name text;
begin
  if tg_op = 'DELETE' then
    delete from public.encrypted_categories where id = old.id;
    return old;
  end if;

  category_name := trim(coalesce(new.name, ''));
  if category_name = '' then
    raise exception '카테고리 이름을 입력해 주세요.';
  end if;

  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid());
    new.sort_order := coalesce(new.sort_order, 0);
    new.is_default := coalesce(new.is_default, false);
    new.is_archived := coalesce(new.is_archived, false);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());
  else
    new.id := old.id;
  end if;

  perform private.validate_category_parent(
    new.id,
    new.ledger_id,
    new.parent_category_id
  );

  if new.parent_category_id is not null and (
    exists (
      select 1
      from public.category_usage_types child_usage
      where child_usage.category_id = new.id
        and not exists (
          select 1
          from public.category_usage_types parent_usage
          where parent_usage.category_id = new.parent_category_id
            and parent_usage.usage_type = child_usage.usage_type
        )
    )
    or not exists (
      select 1
      from public.category_usage_types parent_usage
      where parent_usage.category_id = new.parent_category_id
        and parent_usage.usage_type = new.type
    )
  ) then
    raise exception '하위 카테고리 용도는 상위 카테고리 용도에 포함되어야 합니다.';
  end if;

  if tg_op = 'UPDATE'
    and not old.is_archived
    and new.is_archived
    and exists (
      select 1
      from public.encrypted_categories child
      where child.parent_category_id = old.id
        and not child.is_archived
    )
  then
    raise exception '하위 카테고리를 먼저 이동하거나 제거해 주세요.';
  end if;

  if tg_op = 'INSERT' then
    insert into public.encrypted_categories (
      id, ledger_id, created_by, type, name, icon, color, sort_order,
      is_default, is_archived, created_at, updated_at, private_payload,
      name_blind_index, encryption_key_version, parent_category_id
    ) values (
      new.id, new.ledger_id, new.created_by, new.type, '', new.icon, new.color,
      new.sort_order, new.is_default, new.is_archived, new.created_at,
      new.updated_at,
      private.encrypt_payload(jsonb_build_object('name', category_name)),
      private.blind_index(
        new.ledger_id::text
        || '|'
        || coalesce(new.parent_category_id::text, 'root')
        || '|'
        || category_name
      ),
      1,
      new.parent_category_id
    );
  else
    update public.encrypted_categories
    set
      ledger_id = new.ledger_id,
      created_by = new.created_by,
      type = new.type,
      icon = new.icon,
      color = new.color,
      sort_order = new.sort_order,
      is_default = new.is_default,
      is_archived = new.is_archived,
      parent_category_id = new.parent_category_id,
      updated_at = coalesce(new.updated_at, now()),
      private_payload = private.encrypt_payload(
        jsonb_build_object('name', category_name)
      ),
      name_blind_index = private.blind_index(
        new.ledger_id::text
        || '|'
        || coalesce(new.parent_category_id::text, 'root')
        || '|'
        || category_name
      ),
      encryption_key_version = 1
    where id = old.id;
  end if;

  new.name := category_name;
  return new;
end;
$$;

alter function private.write_categories_view() owner to salimon_crypto_writer;

create or replace function public.set_category_usage_types(
  p_category_id uuid,
  p_usage_types text[]
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_ledger_id uuid;
  target_parent_category_id uuid;
  primary_type text;
begin
  select ledger_id, parent_category_id
  into target_ledger_id, target_parent_category_id
  from public.categories
  where id = p_category_id;

  if target_ledger_id is null
    or not public.has_ledger_role(
      target_ledger_id,
      array['owner', 'admin', 'member']
    )
  then
    raise exception '카테고리 용도를 변경할 권한이 없습니다.';
  end if;

  if coalesce(cardinality(p_usage_types), 0) = 0
    or exists (
      select 1
      from unnest(p_usage_types) usage(value)
      where usage.value not in ('expense', 'income', 'saving')
    )
  then
    raise exception '카테고리 용도를 하나 이상 선택해 주세요.';
  end if;

  if target_parent_category_id is not null and exists (
    select 1
    from unnest(p_usage_types) selected(value)
    where not exists (
      select 1
      from public.category_usage_types parent_usage
      where parent_usage.category_id = target_parent_category_id
        and parent_usage.usage_type = selected.value
    )
  ) then
    raise exception '하위 카테고리 용도는 상위 카테고리 용도에 포함되어야 합니다.';
  end if;

  if exists (
    select 1
    from public.categories child
    join public.category_usage_types child_usage
      on child_usage.category_id = child.id
    where child.parent_category_id = p_category_id
      and not child.is_archived
      and child_usage.usage_type <> all(p_usage_types)
  ) then
    raise exception '하위 카테고리에서 사용하는 용도는 제거할 수 없습니다.';
  end if;

  delete from public.category_usage_types
  where category_id = p_category_id;

  insert into public.category_usage_types (category_id, usage_type)
  select p_category_id, usage.value
  from (
    select distinct value
    from unnest(p_usage_types) selected(value)
  ) usage;

  primary_type := case
    when 'expense' = any(p_usage_types) then 'expense'
    when 'income' = any(p_usage_types) then 'income'
    else 'saving'
  end;

  update public.categories
  set type = primary_type, updated_at = now()
  where id = p_category_id;
end;
$$;

revoke all on function public.set_category_usage_types(uuid, text[])
from public;
grant execute on function public.set_category_usage_types(uuid, text[])
to authenticated;

create or replace function public.create_category_v2(
  p_ledger_id uuid,
  p_name text,
  p_icon text,
  p_color text,
  p_usage_types text[],
  p_parent_category_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  category_id uuid;
  primary_type text;
  next_sort_order int;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not public.has_ledger_role(
    p_ledger_id,
    array['owner', 'admin', 'member']
  ) then
    raise exception '카테고리를 추가할 권한이 없습니다.';
  end if;
  if coalesce(cardinality(p_usage_types), 0) = 0
    or exists (
      select 1
      from unnest(p_usage_types) usage(value)
      where usage.value not in ('expense', 'income', 'saving')
    )
  then
    raise exception '카테고리 용도를 하나 이상 선택해 주세요.';
  end if;

  primary_type := case
    when 'expense' = any(p_usage_types) then 'expense'
    when 'income' = any(p_usage_types) then 'income'
    else 'saving'
  end;

  select coalesce(max(category.sort_order) + 1, 0)
  into next_sort_order
  from public.categories category
  where category.ledger_id = p_ledger_id
    and category.parent_category_id is not distinct from p_parent_category_id
    and not category.is_archived;

  insert into public.categories (
    ledger_id,
    created_by,
    type,
    name,
    icon,
    color,
    sort_order,
    is_default,
    is_archived,
    parent_category_id
  ) values (
    p_ledger_id,
    auth.uid(),
    primary_type,
    p_name,
    p_icon,
    p_color,
    next_sort_order,
    false,
    false,
    p_parent_category_id
  )
  returning id into category_id;

  perform public.set_category_usage_types(category_id, p_usage_types);
  return category_id;
end;
$$;

revoke all on function public.create_category_v2(
  uuid,
  text,
  text,
  text,
  text[],
  uuid
) from public;
grant execute on function public.create_category_v2(
  uuid,
  text,
  text,
  text,
  text[],
  uuid
) to authenticated;

create or replace function public.update_category_v2(
  p_category_id uuid,
  p_name text,
  p_icon text,
  p_color text,
  p_usage_types text[],
  p_parent_category_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target public.categories%rowtype;
  primary_type text;
  next_sort_order int;
begin
  select *
  into target
  from public.categories
  where id = p_category_id;

  if target.id is null
    or not public.has_ledger_role(
      target.ledger_id,
      array['owner', 'admin', 'member']
    )
  then
    raise exception '카테고리를 수정할 권한이 없습니다.';
  end if;
  if coalesce(cardinality(p_usage_types), 0) = 0
    or exists (
      select 1
      from unnest(p_usage_types) usage(value)
      where usage.value not in ('expense', 'income', 'saving')
    )
  then
    raise exception '카테고리 용도를 하나 이상 선택해 주세요.';
  end if;

  primary_type := case
    when 'expense' = any(p_usage_types) then 'expense'
    when 'income' = any(p_usage_types) then 'income'
    else 'saving'
  end;

  next_sort_order := target.sort_order;
  if target.parent_category_id is distinct from p_parent_category_id then
    select coalesce(max(category.sort_order) + 1, 0)
    into next_sort_order
    from public.categories category
    where category.ledger_id = target.ledger_id
      and category.id <> p_category_id
      and category.parent_category_id is not distinct from p_parent_category_id
      and not category.is_archived;
  end if;

  update public.categories
  set
    name = p_name,
    icon = p_icon,
    color = p_color,
    type = primary_type,
    parent_category_id = p_parent_category_id,
    sort_order = next_sort_order,
    updated_at = now()
  where id = p_category_id;

  perform public.set_category_usage_types(p_category_id, p_usage_types);
end;
$$;

revoke all on function public.update_category_v2(
  uuid,
  text,
  text,
  text,
  text[],
  uuid
) from public;
grant execute on function public.update_category_v2(
  uuid,
  text,
  text,
  text,
  text[],
  uuid
) to authenticated;

create or replace function public.archive_category_v2(p_category_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_ledger_id uuid;
begin
  select ledger_id
  into target_ledger_id
  from public.categories
  where id = p_category_id;

  if target_ledger_id is null
    or not public.has_ledger_role(
      target_ledger_id,
      array['owner', 'admin', 'member']
    )
  then
    raise exception '카테고리를 제거할 권한이 없습니다.';
  end if;

  update public.categories
  set is_archived = true, updated_at = now()
  where id = p_category_id;
end;
$$;

revoke all on function public.archive_category_v2(uuid) from public;
grant execute on function public.archive_category_v2(uuid) to authenticated;

create or replace function public.reorder_category_siblings(
  p_parent_category_id uuid,
  p_category_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_ledger_id uuid;
  sibling_count int;
  matched_count int;
  minimum_sort_order int;
  temporary_base int;
begin
  if coalesce(cardinality(p_category_ids), 0) = 0 then
    return;
  end if;
  if (
    select count(distinct category_id)
    from unnest(p_category_ids) ids(category_id)
  ) <> cardinality(p_category_ids) then
    raise exception '카테고리 순서에 중복된 항목이 있습니다.';
  end if;

  select ledger_id
  into target_ledger_id
  from public.categories
  where id = p_category_ids[1]
    and parent_category_id is not distinct from p_parent_category_id
    and not is_archived;

  if target_ledger_id is null
    or not public.has_ledger_role(
      target_ledger_id,
      array['owner', 'admin', 'member']
    )
  then
    raise exception '카테고리 순서를 변경할 권한이 없습니다.';
  end if;

  select count(*)
  into sibling_count
  from public.categories
  where ledger_id = target_ledger_id
    and parent_category_id is not distinct from p_parent_category_id
    and not is_archived;

  select count(*)
  into matched_count
  from public.categories
  where ledger_id = target_ledger_id
    and parent_category_id is not distinct from p_parent_category_id
    and not is_archived
    and id = any(p_category_ids);

  if matched_count <> sibling_count
    or matched_count <> cardinality(p_category_ids)
  then
    raise exception '같은 단계의 모든 카테고리 순서가 필요합니다.';
  end if;

  select coalesce(min(sort_order), 0)
  into minimum_sort_order
  from public.categories
  where ledger_id = target_ledger_id
    and parent_category_id is not distinct from p_parent_category_id;

  temporary_base := least(minimum_sort_order, 0) - sibling_count - 1;

  update public.categories category
  set
    sort_order = temporary_base - ordered.ordinality::int,
    updated_at = now()
  from unnest(p_category_ids) with ordinality
    ordered(category_id, ordinality)
  where category.id = ordered.category_id;

  update public.categories category
  set
    sort_order = ordered.ordinality::int - 1,
    updated_at = now()
  from unnest(p_category_ids) with ordinality
    ordered(category_id, ordinality)
  where category.id = ordered.category_id;
end;
$$;

revoke all on function public.reorder_category_siblings(uuid, uuid[])
from public;
grant execute on function public.reorder_category_siblings(uuid, uuid[])
to authenticated;
