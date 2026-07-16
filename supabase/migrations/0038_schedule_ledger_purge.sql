create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.purge_expired_ledgers()
returns bigint
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  purged_count bigint;
begin
  delete from public.encrypted_ledgers
  where archived_at is not null and purge_after <= now();
  get diagnostics purged_count = row_count;
  return purged_count;
end;
$$;

revoke all on function private.purge_expired_ledgers() from public;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'salimon-purge-expired-ledgers'
  ) then
    perform cron.schedule(
      'salimon-purge-expired-ledgers',
      '20 17 * * *',
      'select private.purge_expired_ledgers()'
    );
  end if;
end;
$$;
