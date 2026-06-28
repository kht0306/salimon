create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  kakao_id text,
  nickname text,
  avatar_url text,
  default_currency text not null default 'KRW',
  timezone text not null default 'Asia/Seoul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ledgers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '내 가계부',
  type text not null default 'personal' check (type in ('personal', 'shared')),
  currency text not null default 'KRW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_members (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  status text not null default 'active' check (status in ('active', 'removed')),
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (ledger_id, user_id)
);

create table if not exists public.ledger_invitations (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  invite_code text not null unique,
  invite_token_hash text not null unique,
  role_to_grant text not null default 'member' check (role_to_grant in ('admin', 'member', 'viewer')),
  status text not null default 'active' check (status in ('active', 'accepted', 'expired', 'revoked')),
  max_uses int not null default 1,
  used_count int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  type text not null check (type in ('expense', 'income', 'transfer')),
  name text not null,
  icon text,
  color text,
  sort_order int not null default 0,
  is_default boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  type text not null check (type in ('cash', 'card', 'bank', 'pay', 'etc')),
  last4 text,
  issuer text,
  visibility text not null default 'ledger' check (visibility in ('ledger', 'private')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid references auth.users(id) on delete set null,
  type text not null check (type in ('expense', 'income', 'transfer')),
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'excluded')),
  amount numeric(14, 2) not null,
  currency text not null default 'KRW',
  transaction_at timestamptz not null,
  category_id uuid references public.categories(id),
  payment_method_id uuid references public.payment_methods(id),
  merchant_name text,
  memo text,
  source_type text not null default 'manual' check (source_type in ('manual', 'android_sms_notification', 'paste', 'import')),
  source_app text,
  source_sender text,
  source_hash text,
  parse_confidence numeric(5, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ledger_id uuid references public.ledgers(id) on delete cascade,
  app_package text not null,
  app_label text,
  sender_filter text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.card_message_samples (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  card_company_name text,
  masked_message text not null,
  expected_amount numeric(14, 2),
  expected_merchant_name text,
  expected_transaction_at timestamptz,
  parse_result jsonb,
  consent_version text not null,
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'applied', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

create unique index if not exists categories_ledger_type_name_active_uidx
on public.categories (ledger_id, type, lower(name))
where is_archived = false;

create index if not exists transactions_ledger_date_idx
on public.transactions (ledger_id, transaction_at desc)
where deleted_at is null;

create index if not exists transactions_created_by_date_idx
on public.transactions (created_by, transaction_at desc)
where deleted_at is null;

create unique index if not exists transactions_ledger_source_hash_uidx
on public.transactions (ledger_id, source_hash)
where source_hash is not null and deleted_at is null;

create or replace function public.is_ledger_member(target_ledger_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ledger_members
    where ledger_id = target_ledger_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.has_ledger_role(target_ledger_id uuid, allowed_roles text[])
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ledger_members
    where ledger_id = target_ledger_id
      and user_id = auth.uid()
      and status = 'active'
      and role = any(allowed_roles)
  );
$$;

alter table public.profiles enable row level security;
alter table public.ledgers enable row level security;
alter table public.ledger_members enable row level security;
alter table public.ledger_invitations enable row level security;
alter table public.categories enable row level security;
alter table public.payment_methods enable row level security;
alter table public.transactions enable row level security;
alter table public.notification_rules enable row level security;
alter table public.card_message_samples enable row level security;

create policy "profiles_select_own" on public.profiles
for select using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles_insert_own" on public.profiles
for insert with check (id = auth.uid());

create policy "ledgers_select_member" on public.ledgers
for select using (public.is_ledger_member(id));

create policy "ledgers_insert_owner" on public.ledgers
for insert with check (owner_id = auth.uid());

create policy "ledgers_update_owner_admin" on public.ledgers
for update using (public.has_ledger_role(id, array['owner', 'admin']))
with check (public.has_ledger_role(id, array['owner', 'admin']));

create policy "ledger_members_select_same_ledger" on public.ledger_members
for select using (public.is_ledger_member(ledger_id));

create policy "ledger_members_manage_owner" on public.ledger_members
for all using (public.has_ledger_role(ledger_id, array['owner']))
with check (public.has_ledger_role(ledger_id, array['owner']));

create policy "ledger_invitations_select_owner_admin" on public.ledger_invitations
for select using (public.has_ledger_role(ledger_id, array['owner', 'admin']));

create policy "ledger_invitations_manage_owner_admin" on public.ledger_invitations
for all using (public.has_ledger_role(ledger_id, array['owner', 'admin']))
with check (public.has_ledger_role(ledger_id, array['owner', 'admin']));

create policy "categories_select_member" on public.categories
for select using (public.is_ledger_member(ledger_id));

create policy "categories_manage_member" on public.categories
for all using (public.has_ledger_role(ledger_id, array['owner', 'admin', 'member']))
with check (public.has_ledger_role(ledger_id, array['owner', 'admin', 'member']));

create policy "payment_methods_select_member" on public.payment_methods
for select using (public.is_ledger_member(ledger_id));

create policy "payment_methods_manage_member" on public.payment_methods
for all using (public.has_ledger_role(ledger_id, array['owner', 'admin', 'member']))
with check (public.has_ledger_role(ledger_id, array['owner', 'admin', 'member']));

create policy "transactions_select_member" on public.transactions
for select using (public.is_ledger_member(ledger_id));

create policy "transactions_insert_member" on public.transactions
for insert with check (public.has_ledger_role(ledger_id, array['owner', 'admin', 'member']));

create policy "transactions_update_member" on public.transactions
for update using (public.has_ledger_role(ledger_id, array['owner', 'admin', 'member']))
with check (public.has_ledger_role(ledger_id, array['owner', 'admin', 'member']));

create policy "transactions_delete_owner_admin" on public.transactions
for delete using (public.has_ledger_role(ledger_id, array['owner', 'admin']));

create policy "notification_rules_own" on public.notification_rules
for all using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "card_message_samples_own" on public.card_message_samples
for all using (submitted_by = auth.uid())
with check (submitted_by = auth.uid());
