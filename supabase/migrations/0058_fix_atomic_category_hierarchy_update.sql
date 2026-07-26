-- Validate and persist category usage types before moving the category so the
-- hierarchy trigger evaluates the requested state rather than the previous one.

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

  perform private.validate_category_parent(
    p_category_id,
    target.ledger_id,
    p_parent_category_id
  );

  if p_parent_category_id is not null and exists (
    select 1
    from unnest(p_usage_types) selected(value)
    where not exists (
      select 1
      from public.category_usage_types parent_usage
      where parent_usage.category_id = p_parent_category_id
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

  delete from public.category_usage_types
  where category_id = p_category_id;

  insert into public.category_usage_types (category_id, usage_type)
  select p_category_id, usage.value
  from (
    select distinct value
    from unnest(p_usage_types) selected(value)
  ) usage;

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
