do $$
declare
  target_user_id uuid;
  source_ledger_id uuid;
  target_ledger_id uuid;
  matched_count int;
  source_category public.categories%rowtype;
  target_category_id uuid;
  source_card public.payment_methods%rowtype;
  target_card_id uuid;
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

  for source_category in
    select *
    from public.categories
    where ledger_id = source_ledger_id
      and not is_archived
    order by type, sort_order, created_at
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
      limit 1;
    end if;

    if target_category_id is null then
      select id
      into target_category_id
      from public.categories
      where ledger_id = target_ledger_id
        and type = source_category.type
        and lower(name) = lower(source_category.name)
        and not is_archived
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
      set is_archived = true, updated_at = now()
      where ledger_id = target_ledger_id
        and type = source_category.type
        and lower(name) = lower(source_category.name)
        and id <> target_category_id
        and not is_archived;

    end if;

    update public.categories
    set
      name = source_category.name,
      icon = source_category.icon,
      color = source_category.color,
      is_archived = false,
      updated_at = now()
    where id = target_category_id;
  end loop;

  update public.payment_methods
  set is_primary = false, updated_at = now()
  where ledger_id = target_ledger_id
    and owner_user_id = target_user_id
    and type = 'card';

  for source_card in
    select *
    from public.payment_methods
    where ledger_id = source_ledger_id
      and owner_user_id = target_user_id
      and type = 'card'
      and deleted_at is null
    order by created_at
  loop
    target_card_id := null;

    select id
    into target_card_id
    from public.payment_methods
    where ledger_id = target_ledger_id
      and owner_user_id = target_user_id
      and type = 'card'
      and lower(name) = lower(source_card.name)
      and last4 is not distinct from source_card.last4
    order by deleted_at nulls first, created_at
    limit 1;

    if target_card_id is null then
      insert into public.payment_methods (
        ledger_id, owner_user_id, name, type, last4, issuer, visibility,
        is_active, is_primary, deleted_at, payment_day,
        billing_period_end_day, billing_period_end_month_offset
      ) values (
        target_ledger_id, target_user_id, source_card.name, source_card.type,
        source_card.last4, source_card.issuer, source_card.visibility,
        source_card.is_active, false, null, source_card.payment_day,
        source_card.billing_period_end_day,
        source_card.billing_period_end_month_offset
      )
      returning id into target_card_id;
    else
      update public.payment_methods
      set
        name = source_card.name,
        last4 = source_card.last4,
        issuer = source_card.issuer,
        visibility = source_card.visibility,
        is_active = source_card.is_active,
        is_primary = false,
        deleted_at = null,
        payment_day = source_card.payment_day,
        billing_period_end_day = source_card.billing_period_end_day,
        billing_period_end_month_offset = source_card.billing_period_end_month_offset,
        updated_at = now()
      where id = target_card_id;
    end if;

    if source_card.is_primary and source_card.is_active then
      update public.payment_methods
      set is_primary = true, updated_at = now()
      where id = target_card_id;
    end if;
  end loop;
end;
$$;
