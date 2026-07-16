create or replace function public.deactivate_fixed_rule_from_month(
  p_rule_id uuid,
  p_month date
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_rule public.recurring_rules%rowtype;
  cutoff_month date := date_trunc('month', p_month)::date;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select *
  into target_rule
  from public.recurring_rules
  where id = p_rule_id
    and rule_type = 'fixed'
  for update;

  if target_rule.id is null then
    raise exception '해제할 고정비를 찾을 수 없습니다.';
  end if;

  if not public.has_ledger_role(
    target_rule.ledger_id,
    array['owner', 'admin', 'member']
  ) then
    raise exception '고정비를 해제할 권한이 없습니다.';
  end if;

  update public.recurring_rules
  set
    inactive_from_month = cutoff_month,
    is_active = false,
    updated_at = now()
  where id = p_rule_id;

  update public.transactions
  set
    deleted_at = now(),
    updated_by = auth.uid(),
    updated_at = now()
  where recurring_rule_id = p_rule_id
    and deleted_at is null
    and timezone('Asia/Seoul', transaction_at)::date >= cutoff_month;
end;
$$;

revoke all on function public.deactivate_fixed_rule_from_month(uuid, date)
from public;
grant execute on function public.deactivate_fixed_rule_from_month(uuid, date)
to authenticated;
