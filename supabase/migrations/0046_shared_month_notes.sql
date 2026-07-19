-- A short encrypted monthly note lets household members document settlement
-- decisions without hiding them in an individual transaction memo.

create table public.encrypted_ledger_month_notes (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.encrypted_ledgers(id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  note text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  private_payload bytea not null,
  encryption_key_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ledger_id, month)
);

alter table public.encrypted_ledger_month_notes enable row level security;

create policy "ledger_month_notes_select_member"
on public.encrypted_ledger_month_notes for select to authenticated
using (public.is_ledger_member(ledger_id));

create policy "ledger_month_notes_write_member"
on public.encrypted_ledger_month_notes for all to salimon_crypto_writer
using (public.has_ledger_role(ledger_id, array['owner', 'admin', 'member']))
with check (public.has_ledger_role(ledger_id, array['owner', 'admin', 'member']));

grant select, insert, update, delete on public.encrypted_ledger_month_notes
to salimon_crypto_writer;
grant select on public.encrypted_ledger_month_notes to authenticated;

create view public.ledger_month_notes
with (security_invoker = true)
as
select
  item.id,
  item.ledger_id,
  item.month,
  private.decrypt_payload(item.private_payload) ->> 'note' as note,
  item.updated_by,
  item.created_at,
  item.updated_at
from public.encrypted_ledger_month_notes item;

grant select, insert, update, delete on public.ledger_month_notes
to authenticated;

create or replace function private.write_ledger_month_notes_view()
returns trigger
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;

  if tg_op = 'DELETE' then
    if not public.has_ledger_role(old.ledger_id, array['owner', 'admin', 'member']) then
      raise exception '월 정산 메모를 삭제할 권한이 없습니다.';
    end if;
    delete from public.encrypted_ledger_month_notes where id = old.id;
    return old;
  end if;

  if not public.has_ledger_role(new.ledger_id, array['owner', 'admin', 'member']) then
    raise exception '월 정산 메모를 저장할 권한이 없습니다.';
  end if;
  if char_length(coalesce(new.note, '')) > 1000 then
    raise exception '월 정산 메모는 1,000자 이내로 입력해 주세요.';
  end if;

  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid());
    new.updated_by := auth.uid();
    insert into public.encrypted_ledger_month_notes (
      id, ledger_id, month, note, updated_by, private_payload,
      encryption_key_version, created_at, updated_at
    ) values (
      new.id, new.ledger_id, date_trunc('month', new.month)::date, '',
      auth.uid(), private.encrypt_payload(jsonb_build_object(
        'note', coalesce(new.note, '')
      )), 1, coalesce(new.created_at, now()), now()
    );
    return new;
  end if;

  update public.encrypted_ledger_month_notes
  set private_payload = private.encrypt_payload(jsonb_build_object(
        'note', coalesce(new.note, '')
      )),
      encryption_key_version = 1,
      updated_by = auth.uid(),
      updated_at = now()
  where id = old.id and ledger_id = old.ledger_id;
  return new;
end;
$$;

alter function private.write_ledger_month_notes_view()
  owner to salimon_crypto_writer;
revoke all on function private.write_ledger_month_notes_view() from public;

create trigger ledger_month_notes_secure_write
instead of insert or update or delete on public.ledger_month_notes
for each row execute function private.write_ledger_month_notes_view();
