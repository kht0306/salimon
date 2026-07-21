create or replace function public.archive_ledger(p_ledger_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not exists (
    select 1
    from public.encrypted_ledgers
    where id = p_ledger_id
      and owner_id = auth.uid()
      and archived_at is null
  ) then
    raise exception '소유한 가계부만 제거할 수 있습니다.';
  end if;

  if exists (
    select 1
    from public.encrypted_ledger_members
    where ledger_id = p_ledger_id
      and user_id = auth.uid()
      and status = 'active'
      and is_default
  ) then
    raise exception '다른 가계부를 기본 가계부로 설정한 후 제거할 수 있습니다.';
  end if;

  update public.encrypted_ledgers
  set archived_at = now(),
      purge_after = now() + interval '30 days',
      updated_at = now()
  where id = p_ledger_id;
end;
$$;

revoke all on function public.archive_ledger(uuid) from public;
grant execute on function public.archive_ledger(uuid) to authenticated;
