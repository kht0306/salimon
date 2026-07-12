create or replace function public.reorder_categories(p_category_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_ledger_id uuid;
  target_type text;
  category_count int;
  matched_count int;
  minimum_sort_order int;
  temporary_base int;
begin
  category_count := coalesce(cardinality(p_category_ids), 0);
  if category_count = 0 then
    return;
  end if;

  if (
    select count(distinct category_id)
    from unnest(p_category_ids) as ids(category_id)
  ) <> category_count then
    raise exception '카테고리 순서에 중복된 항목이 있습니다.';
  end if;

  select ledger_id, type
  into target_ledger_id, target_type
  from public.categories
  where id = p_category_ids[1];

  if target_ledger_id is null
    or not public.has_ledger_role(
      target_ledger_id,
      array['owner', 'admin', 'member']
    ) then
    raise exception '카테고리 순서를 변경할 권한이 없습니다.';
  end if;

  select count(*)
  into matched_count
  from public.categories
  where ledger_id = target_ledger_id
    and type = target_type
    and id = any(p_category_ids);

  select count(*)
  into category_count
  from public.categories
  where ledger_id = target_ledger_id
    and type = target_type;

  if matched_count <> category_count
    or matched_count <> cardinality(p_category_ids) then
    raise exception '같은 유형의 모든 카테고리 순서가 필요합니다.';
  end if;

  select coalesce(min(sort_order), 0)
  into minimum_sort_order
  from public.categories
  where ledger_id = target_ledger_id
    and type = target_type;

  temporary_base := least(minimum_sort_order, 0) - category_count - 1;

  update public.categories as category
  set
    sort_order = temporary_base - ordered.ordinality::int,
    updated_at = now()
  from unnest(p_category_ids) with ordinality as ordered(category_id, ordinality)
  where category.id = ordered.category_id;

  update public.categories as category
  set
    sort_order = ordered.ordinality::int - 1,
    updated_at = now()
  from unnest(p_category_ids) with ordinality as ordered(category_id, ordinality)
  where category.id = ordered.category_id;
end;
$$;

grant execute on function public.reorder_categories(uuid[]) to authenticated;
