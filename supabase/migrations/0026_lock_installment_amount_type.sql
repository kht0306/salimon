create or replace function public.prevent_installment_amount_type_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.rule_type = 'installment'
    and new.installment_amount_type is distinct from old.installment_amount_type then
    raise exception '할부 거래는 할부 금액 입력 방식을 변경할 수 없습니다.';
  end if;

  return new;
end;
$$;

drop trigger if exists recurring_rules_lock_installment_amount_type
on public.recurring_rules;

create trigger recurring_rules_lock_installment_amount_type
before update of installment_amount_type on public.recurring_rules
for each row
execute function public.prevent_installment_amount_type_change();
