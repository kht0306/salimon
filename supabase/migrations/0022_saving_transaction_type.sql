-- Add savings as an independent transaction type and allow each category to
-- be used by one or more of expense, income, and saving transactions.

alter table public.categories
  drop constraint if exists categories_type_check;
alter table public.categories
  add constraint categories_type_check
  check (type in ('expense', 'income', 'transfer', 'saving'));

alter table public.transactions
  drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
  check (type in ('expense', 'income', 'transfer', 'saving'));

alter table public.recurring_rules
  drop constraint if exists recurring_rules_transaction_type_check;
alter table public.recurring_rules
  add constraint recurring_rules_transaction_type_check
  check (transaction_type in ('expense', 'income', 'transfer', 'saving'));

-- Existing ledgers receive useful saving categories. Transfers deliberately
-- reuse every category and therefore do not need their own category set.
insert into public.categories (
  ledger_id, created_by, type, name, icon, color, sort_order, is_default
)
select
  ledger.id,
  ledger.owner_id,
  'saving',
  preset.name,
  preset.icon,
  preset.color,
  preset.sort_order,
  true
from public.ledgers ledger
cross join (
  values
    ('예금', 'landmark', '#0f766e', 0),
    ('적금', 'piggy-bank', '#7c3aed', 1),
    ('투자', 'chart-no-axes-combined', '#2563eb', 2),
    ('기타 저축', 'wallet', '#727a82', 3)
) as preset(name, icon, color, sort_order)
where not exists (
  select 1
  from public.categories category
  where category.ledger_id = ledger.id
    and category.type = 'saving'
    and category.name = preset.name
    and not category.is_archived
);

create table if not exists public.category_usage_types (
  category_id uuid not null references public.categories(id) on delete cascade,
  usage_type text not null check (usage_type in ('expense', 'income', 'saving')),
  created_at timestamptz not null default now(),
  primary key (category_id, usage_type)
);

alter table public.category_usage_types enable row level security;

create policy "category_usage_types_select_member"
on public.category_usage_types
for select
using (
  exists (
    select 1
    from public.categories category
    where category.id = category_id
      and public.is_ledger_member(category.ledger_id)
  )
);

create policy "category_usage_types_manage_member"
on public.category_usage_types
for all
using (
  exists (
    select 1
    from public.categories category
    where category.id = category_id
      and public.has_ledger_role(
        category.ledger_id,
        array['owner', 'admin', 'member']
      )
  )
)
with check (
  exists (
    select 1
    from public.categories category
    where category.id = category_id
      and public.has_ledger_role(
        category.ledger_id,
        array['owner', 'admin', 'member']
      )
  )
);

-- Preserve each existing category's meaning during migration.
insert into public.category_usage_types (category_id, usage_type)
select
  category.id,
  case
    when category.type = 'income' then 'income'
    when category.type = 'saving' then 'saving'
    else 'expense'
  end
from public.categories category
on conflict do nothing;

create or replace function public.seed_category_usage_type()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.category_usage_types (category_id, usage_type)
  values (
    new.id,
    case
      when new.type = 'income' then 'income'
      when new.type = 'saving' then 'saving'
      else 'expense'
    end
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists categories_seed_usage_type_after_insert
on public.categories;

create trigger categories_seed_usage_type_after_insert
after insert on public.categories
for each row
execute function public.seed_category_usage_type();

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
  primary_type text;
begin
  select ledger_id
  into target_ledger_id
  from public.categories
  where id = p_category_id;

  if target_ledger_id is null
    or not public.has_ledger_role(
      target_ledger_id,
      array['owner', 'admin', 'member']
    ) then
    raise exception '카테고리 용도를 변경할 권한이 없습니다.';
  end if;

  if coalesce(cardinality(p_usage_types), 0) = 0
    or exists (
      select 1
      from unnest(p_usage_types) usage(value)
      where usage.value not in ('expense', 'income', 'saving')
    ) then
    raise exception '카테고리 용도를 하나 이상 선택해 주세요.';
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

-- New ledgers receive saving categories; their expense and income categories
-- continue to be created by the existing workspace functions.
create or replace function public.seed_saving_categories()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.categories (
    ledger_id, created_by, type, name, icon, color, sort_order, is_default
  ) values
    (new.id, new.owner_id, 'saving', '예금', 'landmark', '#0f766e', 0, true),
    (new.id, new.owner_id, 'saving', '적금', 'piggy-bank', '#7c3aed', 1, true),
    (new.id, new.owner_id, 'saving', '투자', 'chart-no-axes-combined', '#2563eb', 2, true),
    (new.id, new.owner_id, 'saving', '기타 저축', 'wallet', '#727a82', 3, true)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists ledgers_seed_saving_categories
on public.ledgers;

create trigger ledgers_seed_saving_categories
after insert on public.ledgers
for each row
execute function public.seed_saving_categories();

-- Move from per-type ordering to one stable order for the complete category
-- list. The temporary negative values avoid conflicts with the existing
-- partial unique index for default category slots.
create temporary table category_global_order on commit drop as
select
  category.id,
  row_number() over (
    partition by category.ledger_id
    order by
      category.sort_order,
      case category.type
        when 'expense' then 0
        when 'income' then 1
        when 'saving' then 2
        else 3
      end,
      category.created_at,
      category.id
  )::int - 1 as next_sort_order
from public.categories category;

update public.categories category
set sort_order = -1000000 - ordering.next_sort_order
from category_global_order ordering
where category.id = ordering.id;

update public.categories category
set sort_order = ordering.next_sort_order
from category_global_order ordering
where category.id = ordering.id;

create or replace function public.reorder_categories(p_category_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_ledger_id uuid;
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
    from unnest(p_category_ids) ids(category_id)
  ) <> category_count then
    raise exception '카테고리 순서에 중복된 항목이 있습니다.';
  end if;

  select ledger_id
  into target_ledger_id
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
    and id = any(p_category_ids);

  select count(*)
  into category_count
  from public.categories
  where ledger_id = target_ledger_id;

  if matched_count <> category_count
    or matched_count <> cardinality(p_category_ids) then
    raise exception '가계부의 모든 카테고리 순서가 필요합니다.';
  end if;

  select coalesce(min(sort_order), 0)
  into minimum_sort_order
  from public.categories
  where ledger_id = target_ledger_id;

  temporary_base := least(minimum_sort_order, 0) - category_count - 1;

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

revoke all on function public.reorder_categories(uuid[]) from public;
grant execute on function public.reorder_categories(uuid[]) to authenticated;
