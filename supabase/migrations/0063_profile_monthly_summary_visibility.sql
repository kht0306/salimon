alter table public.encrypted_profiles
  add column if not exists monthly_summary_visible boolean not null default true;

create or replace view public.profiles
with (security_invoker = true)
as
select
  p.id,
  d.payload ->> 'kakao_id' as kakao_id,
  d.payload ->> 'nickname' as nickname,
  d.payload ->> 'avatar_url' as avatar_url,
  p.default_currency,
  p.timezone,
  p.created_at,
  p.updated_at,
  p.monthly_summary_visible
from public.encrypted_profiles p
cross join lateral (
  select private.decrypt_payload(p.private_payload) as payload
) d;

create or replace function private.write_profiles_view()
returns trigger language plpgsql security definer
set search_path = private, public, pg_catalog as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());
    new.monthly_summary_visible := coalesce(new.monthly_summary_visible, true);
    insert into public.encrypted_profiles (
      id, kakao_id, nickname, avatar_url, default_currency, timezone,
      created_at, updated_at, private_payload, encryption_key_version,
      monthly_summary_visible
    ) values (
      new.id, null, null, null, coalesce(new.default_currency, 'KRW'),
      coalesce(new.timezone, 'Asia/Seoul'), new.created_at, new.updated_at,
      private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
        'kakao_id', new.kakao_id, 'nickname', new.nickname,
        'avatar_url', new.avatar_url
      ))), 1, new.monthly_summary_visible
    );
    return new;
  elsif tg_op = 'UPDATE' then
    new.id := old.id;
    new.monthly_summary_visible := coalesce(new.monthly_summary_visible, true);
    update public.encrypted_profiles
    set default_currency = new.default_currency,
        timezone = new.timezone,
        updated_at = coalesce(new.updated_at, now()),
        private_payload = private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
          'kakao_id', new.kakao_id, 'nickname', new.nickname,
          'avatar_url', new.avatar_url
        ))),
        encryption_key_version = 1,
        monthly_summary_visible = new.monthly_summary_visible
    where id = old.id;
    return new;
  else
    delete from public.encrypted_profiles where id = old.id;
    return old;
  end if;
end;
$$;
