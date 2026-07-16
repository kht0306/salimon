create or replace function public.set_default_ledger(p_ledger_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  -- Serialize default-ledger changes for the same user so rapid requests cannot
  -- interleave and temporarily create two default memberships.
  perform pg_advisory_xact_lock(
    hashtextextended('set_default_ledger:' || current_user_id::text, 0)
  );

  if not exists (
    select 1
    from public.encrypted_ledger_members
    where ledger_id = p_ledger_id
      and user_id = current_user_id
      and status = 'active'
  ) then
    raise exception '참여 중인 가계부만 기본으로 설정할 수 있습니다.';
  end if;

  -- A partial unique index allows only one active default per user. Updating
  -- old and new rows in one statement can check the new row before the old row
  -- is cleared, so keep the transition in this explicit order.
  update public.encrypted_ledger_members
  set is_default = false
  where user_id = current_user_id
    and status = 'active'
    and is_default
    and ledger_id <> p_ledger_id;

  update public.encrypted_ledger_members
  set is_default = true
  where ledger_id = p_ledger_id
    and user_id = current_user_id
    and status = 'active'
    and not is_default;
end;
$$;

revoke all on function public.set_default_ledger(uuid) from public;
grant execute on function public.set_default_ledger(uuid) to authenticated;
