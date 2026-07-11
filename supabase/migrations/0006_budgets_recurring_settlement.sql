create table if not exists public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  effective_month date not null check (extract(day from effective_month) = 1),
  amount numeric(14, 2) not null check (amount >= 0),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (category_id, effective_month)
);

create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  rule_type text not null check (rule_type in ('fixed', 'installment')),
  amount numeric(14, 2) not null check (amount > 0),
  day_of_month int not null check (day_of_month between 1 and 31),
  time_of_day time not null default '12:00',
  start_month date not null check (extract(day from start_month) = 1),
  end_month date,
  inactive_from_month date,
  installment_months int check (installment_months is null or installment_months between 2 and 120),
  category_id uuid references public.categories(id) on delete set null,
  merchant_name text,
  memo text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions
  add column if not exists recurring_rule_id uuid references public.recurring_rules(id) on delete set null,
  add column if not exists recurring_type text check (recurring_type in ('fixed', 'installment')),
  add column if not exists installment_number int,
  add column if not exists installment_total int;

create unique index if not exists transactions_recurring_month_uidx
on public.transactions (recurring_rule_id, installment_number)
where recurring_rule_id is not null and deleted_at is null;

alter table public.category_budgets enable row level security;
alter table public.recurring_rules enable row level security;

create policy "category_budgets_select_member" on public.category_budgets
for select using (public.is_ledger_member(ledger_id));
create policy "category_budgets_manage_member" on public.category_budgets
for all using (public.has_ledger_role(ledger_id, array['owner', 'admin', 'member']))
with check (public.has_ledger_role(ledger_id, array['owner', 'admin', 'member']));
create policy "recurring_rules_select_member" on public.recurring_rules
for select using (public.is_ledger_member(ledger_id));
create policy "recurring_rules_manage_member" on public.recurring_rules
for all using (public.has_ledger_role(ledger_id, array['owner', 'admin', 'member']))
with check (public.has_ledger_role(ledger_id, array['owner', 'admin', 'member']));

create or replace function public.materialize_finance_month(target_month date)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  rule public.recurring_rules%rowtype;
  month_start date := date_trunc('month', target_month)::date;
  occurrence_no int;
  occurrence_date date;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  for rule in select * from public.recurring_rules r
    where public.is_ledger_member(r.ledger_id)
      and r.start_month <= month_start
      and (r.end_month is null or r.end_month >= month_start)
      and (r.inactive_from_month is null or r.inactive_from_month > month_start)
  loop
    occurrence_no := ((extract(year from month_start)::int - extract(year from rule.start_month)::int) * 12
      + extract(month from month_start)::int - extract(month from rule.start_month)::int) + 1;
    if rule.rule_type = 'installment' and occurrence_no > coalesce(rule.installment_months, 0) then continue; end if;
    occurrence_date := make_date(extract(year from month_start)::int, extract(month from month_start)::int,
      least(rule.day_of_month, extract(day from (month_start + interval '1 month - 1 day'))::int));
    insert into public.transactions (
      ledger_id, created_by, updated_by, actor_user_id, type, status, amount, currency,
      transaction_at, category_id, merchant_name, memo, source_type, recurring_rule_id,
      recurring_type, installment_number, installment_total
    ) values (
      rule.ledger_id, rule.created_by, rule.created_by, null, 'expense', 'confirmed', rule.amount, 'KRW',
      occurrence_date + rule.time_of_day, rule.category_id, rule.merchant_name, rule.memo, 'manual', rule.id,
      rule.rule_type, occurrence_no, case when rule.rule_type = 'installment' then rule.installment_months else null end
    ) on conflict (recurring_rule_id, installment_number) where recurring_rule_id is not null and deleted_at is null do nothing;
  end loop;
end;
$$;

grant execute on function public.materialize_finance_month(date) to authenticated;
