create or replace function public.ensure_user_workspace()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_record auth.users%rowtype;
  default_ledger_id uuid;
  display_name text;
  profile_image text;
  provider_user_id text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select *
  into current_user_record
  from auth.users
  where id = auth.uid();

  display_name := coalesce(
    nullif(current_user_record.raw_user_meta_data ->> 'name', ''),
    nullif(current_user_record.raw_user_meta_data ->> 'user_name', ''),
    nullif(current_user_record.raw_user_meta_data ->> 'full_name', ''),
    nullif(split_part(coalesce(current_user_record.email, ''), '@', 1), ''),
    'Salimon 사용자'
  );
  profile_image := coalesce(
    nullif(current_user_record.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(current_user_record.raw_user_meta_data ->> 'picture', '')
  );
  provider_user_id := nullif(current_user_record.raw_user_meta_data ->> 'sub', '');

  insert into public.profiles (id, kakao_id, nickname, avatar_url)
  values (auth.uid(), provider_user_id, display_name, profile_image)
  on conflict (id) do update
  set kakao_id = coalesce(excluded.kakao_id, public.profiles.kakao_id),
      nickname = excluded.nickname,
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      updated_at = now();

  select ledgers.id
  into default_ledger_id
  from public.ledgers
  where ledgers.owner_id = auth.uid()
    and ledgers.type = 'personal'
  order by ledgers.created_at
  limit 1;

  if default_ledger_id is null then
    insert into public.ledgers (owner_id, name, type, currency)
    values (auth.uid(), '내 가계부', 'personal', 'KRW')
    returning id into default_ledger_id;
  end if;

  insert into public.ledger_members (ledger_id, user_id, role, status, removed_at)
  values (default_ledger_id, auth.uid(), 'owner', 'active', null)
  on conflict (ledger_id, user_id) do update
  set role = 'owner',
      status = 'active',
      removed_at = null;

  insert into public.categories
    (ledger_id, created_by, type, name, icon, color, sort_order, is_default)
  values
    (default_ledger_id, auth.uid(), 'expense', '식비', 'utensils', '#E4572E', 0, true),
    (default_ledger_id, auth.uid(), 'expense', '카페/간식', 'coffee', '#F3A712', 1, true),
    (default_ledger_id, auth.uid(), 'expense', '교통', 'bus', '#2D6A4F', 2, true),
    (default_ledger_id, auth.uid(), 'expense', '생활', 'shopping-basket', '#0F8B8D', 3, true),
    (default_ledger_id, auth.uid(), 'expense', '기타', 'ellipsis', '#6B746D', 4, true),
    (default_ledger_id, auth.uid(), 'income', '급여', 'wallet-cards', '#2D6A4F', 0, true),
    (default_ledger_id, auth.uid(), 'income', '기타 수입', 'circle-plus', '#0F8B8D', 1, true)
  on conflict do nothing;

  return default_ledger_id;
end;
$$;

revoke all on function public.ensure_user_workspace() from public;
grant execute on function public.ensure_user_workspace() to authenticated;
