update public.encrypted_payment_methods p
set visibility = 'private'
from public.encrypted_ledgers l
where l.id = p.ledger_id
  and l.type = 'personal'
  and p.visibility <> 'private';

create or replace function private.enforce_personal_payment_privacy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if exists (
    select 1 from public.encrypted_ledgers l
    where l.id = new.ledger_id and l.type = 'personal'
  ) then
    new.visibility := 'private';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_personal_payment_privacy() from public;

create trigger encrypted_payment_methods_personal_privacy
before insert on public.encrypted_payment_methods
for each row execute function private.enforce_personal_payment_privacy();
