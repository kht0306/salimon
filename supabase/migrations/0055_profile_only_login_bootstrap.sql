create or replace function public.ensure_user_profile()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_record auth.users%rowtype;
  display_name text;
  profile_image text;
  provider_user_id text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
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
    '살림온 사용자'
  );
  profile_image := coalesce(
    nullif(current_user_record.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(current_user_record.raw_user_meta_data ->> 'picture', '')
  );
  provider_user_id := nullif(
    current_user_record.raw_user_meta_data ->> 'sub',
    ''
  );

  insert into public.profiles (id, kakao_id, nickname, avatar_url)
  values (auth.uid(), provider_user_id, display_name, profile_image)
  on conflict (id) do update
  set kakao_id = coalesce(excluded.kakao_id, public.profiles.kakao_id),
      nickname = excluded.nickname,
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      updated_at = now();
end;
$$;

revoke all on function public.ensure_user_profile() from public;
grant execute on function public.ensure_user_profile() to authenticated;

-- Keep the previous frontend call working during deployment, but stop creating
-- a personal ledger. Existing callers only verify that a UUID was returned.
create or replace function public.ensure_user_workspace()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.ensure_user_profile();
  return auth.uid();
end;
$$;

revoke all on function public.ensure_user_workspace() from public;
grant execute on function public.ensure_user_workspace() to authenticated;

create or replace function public.accept_ledger_invite_and_set_default(
  submitted_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
  target_ledger_id uuid;
begin
  result := public.accept_ledger_invite(submitted_code);

  if (result ->> 'status') in ('accepted', 'already_member') then
    target_ledger_id := nullif(result ->> 'ledgerId', '')::uuid;

    if target_ledger_id is not null and not exists (
      select 1
      from public.ledger_members
      where user_id = auth.uid()
        and status = 'active'
        and is_default
    ) then
      perform public.set_default_ledger(target_ledger_id);
    end if;
  end if;

  return result;
end;
$$;

revoke all on function public.accept_ledger_invite_and_set_default(text)
from public;
grant execute on function public.accept_ledger_invite_and_set_default(text)
to authenticated;
