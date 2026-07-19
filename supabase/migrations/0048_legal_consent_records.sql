-- Versioned, append-only consent evidence. No IP address or user-agent is
-- collected because they are not required to prove the in-app choice.

create table public.legal_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now()
);

alter table public.legal_consents enable row level security;
alter table public.legal_consent_events enable row level security;

create policy "legal_consents_select_own"
on public.legal_consents for select to authenticated
using (user_id = auth.uid());

create policy "legal_consent_events_select_own"
on public.legal_consent_events for select to authenticated
using (user_id = auth.uid());

revoke insert, update, delete on public.legal_consents
from anon, authenticated;
revoke insert, update, delete on public.legal_consent_events
from anon, authenticated;
grant select on public.legal_consents, public.legal_consent_events
to authenticated;

create or replace function public.accept_current_legal_terms(
  p_terms_version text,
  p_privacy_version text
)
returns timestamptz
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  accepted timestamptz := now();
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if p_terms_version <> '2026-07-19-v1'
    or p_privacy_version <> '2026-07-19-v1' then
    raise exception '최신 약관과 개인정보 처리방침을 다시 확인해 주세요.';
  end if;

  insert into public.legal_consent_events (
    user_id, terms_version, privacy_version, accepted_at
  ) values (
    auth.uid(), p_terms_version, p_privacy_version, accepted
  );

  insert into public.legal_consents (
    user_id, terms_version, privacy_version, accepted_at, updated_at
  ) values (
    auth.uid(), p_terms_version, p_privacy_version, accepted, accepted
  )
  on conflict (user_id) do update
  set terms_version = excluded.terms_version,
      privacy_version = excluded.privacy_version,
      accepted_at = excluded.accepted_at,
      updated_at = excluded.updated_at;

  return accepted;
end;
$$;

revoke all on function public.accept_current_legal_terms(text, text)
from public;
grant execute on function public.accept_current_legal_terms(text, text)
to authenticated;
