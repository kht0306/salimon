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

  if exists (select 1 from public.profiles where id = auth.uid()) then
    update public.profiles
    set kakao_id = coalesce(provider_user_id, kakao_id),
        nickname = display_name,
        avatar_url = coalesce(profile_image, avatar_url),
        updated_at = now()
    where id = auth.uid();
  else
    insert into public.profiles (id, kakao_id, nickname, avatar_url)
    values (auth.uid(), provider_user_id, display_name, profile_image);
  end if;
end;
$$;

revoke all on function public.ensure_user_profile() from public;
grant execute on function public.ensure_user_profile() to authenticated;
