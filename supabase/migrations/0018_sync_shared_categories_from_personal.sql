do $$
declare
  target_user_id uuid;
  source_ledger_id uuid;
  target_ledger_id uuid;
  matched_count int;
  source_category public.categories%rowtype;
  target_category_id uuid;
begin
  select count(*), (array_agg(id order by created_at))[1]
  into matched_count, target_user_id
  from public.profiles
  where nickname = '김흥태';

  if matched_count <> 1 then
    raise exception '김흥태 프로필이 정확히 1개여야 합니다. 현재: %개', matched_count;
  end if;

  select count(*), (array_agg(id order by created_at))[1]
  into matched_count, source_ledger_id
  from public.ledgers
  where owner_id = target_user_id
    and type = 'personal';

  if matched_count <> 1 then
    raise exception '김흥태 개인 가계부가 정확히 1개여야 합니다. 현재: %개', matched_count;
  end if;

  select count(*), (array_agg(ledger.id order by ledger.created_at))[1]
  into matched_count, target_ledger_id
  from public.ledgers ledger
  where ledger.type = 'shared'
    and ledger.id <> source_ledger_id
    and exists (
      select 1
      from public.ledger_members member
      where member.ledger_id = ledger.id
        and member.user_id = target_user_id
        and member.status = 'active'
    );

  if matched_count <> 1 then
    raise exception '김흥태가 참여 중인 공유 가계부가 정확히 1개여야 합니다. 현재: %개', matched_count;
  end if;

  create temporary table category_sync_map (
    source_category_id uuid primary key,
    target_category_id uuid not null unique
  ) on commit drop;

  -- Preserve referenced rows for existing shared transactions, but hide every
  -- target category until it is matched to an active personal category.
  update public.categories
  set is_archived = true, updated_at = now()
  where ledger_id = target_ledger_id
    and not is_archived;

  for source_category in
    select *
    from public.categories
    where ledger_id = source_ledger_id
      and not is_archived
    order by type, is_default desc, sort_order, created_at
  loop
    target_category_id := null;

    if source_category.is_default then
      select id
      into target_category_id
      from public.categories
      where ledger_id = target_ledger_id
        and type = source_category.type
        and is_default
        and sort_order = source_category.sort_order
      order by created_at
      limit 1;
    end if;

    if target_category_id is null then
      select id
      into target_category_id
      from public.categories
      where ledger_id = target_ledger_id
        and type = source_category.type
        and lower(name) = lower(source_category.name)
      order by is_default desc, created_at
      limit 1;
    end if;

    if target_category_id is null then
      insert into public.categories (
        ledger_id, created_by, type, name, icon, color, sort_order,
        is_default, is_archived
      ) values (
        target_ledger_id, target_user_id, source_category.type,
        source_category.name, source_category.icon, source_category.color,
        source_category.sort_order, source_category.is_default, false
      )
      returning id into target_category_id;
    else
      update public.categories
      set
        created_by = target_user_id,
        type = source_category.type,
        name = source_category.name,
        icon = source_category.icon,
        color = source_category.color,
        sort_order = source_category.sort_order,
        is_default = source_category.is_default,
        is_archived = false,
        updated_at = now()
      where id = target_category_id;
    end if;

    -- The default-category insert trigger applies a generic preset. Restore the
    -- exact personal values after either inserting or updating.
    update public.categories
    set
      name = source_category.name,
      icon = source_category.icon,
      color = source_category.color,
      sort_order = source_category.sort_order,
      is_default = source_category.is_default,
      is_archived = false,
      updated_at = now()
    where id = target_category_id;

    insert into category_sync_map (source_category_id, target_category_id)
    values (source_category.id, target_category_id);
  end loop;

  delete from public.category_budgets
  where ledger_id = target_ledger_id;

  insert into public.category_budgets (
    ledger_id, category_id, effective_month, amount, created_by, created_at
  )
  select
    target_ledger_id,
    category_map.target_category_id,
    source_budget.effective_month,
    source_budget.amount,
    target_user_id,
    source_budget.created_at
  from public.category_budgets source_budget
  join category_sync_map category_map
    on category_map.source_category_id = source_budget.category_id
  where source_budget.ledger_id = source_ledger_id;
end;
$$;
