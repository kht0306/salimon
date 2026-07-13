create or replace function public.create_ledger(
  p_name text,
  p_type text,
  p_set_default boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_ledger_id uuid;
  display_name text;
  normalized_name text;
  should_set_default boolean;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  normalized_name := trim(coalesce(p_name, ''));
  if normalized_name = '' then
    raise exception '가계부 이름을 입력해 주세요.';
  end if;

  if char_length(normalized_name) > 30 then
    raise exception '가계부 이름은 30자 이내로 입력해 주세요.';
  end if;

  if normalized_name ~ '[[:cntrl:]]' then
    raise exception '가계부 이름에 사용할 수 없는 문자가 포함되어 있습니다.';
  end if;

  if p_type is null or p_type not in ('personal', 'shared') then
    raise exception '가계부 유형을 확인해 주세요.';
  end if;

  select nickname
  into display_name
  from public.profiles
  where id = auth.uid();

  should_set_default := p_set_default or not exists (
    select 1
    from public.ledger_members
    where user_id = auth.uid()
      and status = 'active'
      and is_default
  );

  if should_set_default then
    update public.ledger_members
    set is_default = false
    where user_id = auth.uid()
      and status = 'active'
      and is_default;
  end if;

  insert into public.ledgers (owner_id, name, type, currency)
  values (auth.uid(), normalized_name, p_type, 'KRW')
  returning id into new_ledger_id;

  insert into public.ledger_members (
    ledger_id, user_id, nickname, role, status, is_default
  ) values (
    new_ledger_id,
    auth.uid(),
    coalesce(display_name, 'Salimon 사용자'),
    'owner',
    'active',
    should_set_default
  );

  insert into public.categories (
    ledger_id, created_by, type, name, icon, color, sort_order, is_default
  ) values
    (new_ledger_id, auth.uid(), 'expense', '식비', 'utensils', '#E4572E', 0, true),
    (new_ledger_id, auth.uid(), 'expense', '카페/간식', 'coffee', '#F3A712', 1, true),
    (new_ledger_id, auth.uid(), 'expense', '교통', 'bus', '#2D6A4F', 2, true),
    (new_ledger_id, auth.uid(), 'expense', '생활', 'shopping-basket', '#0F8B8D', 3, true),
    (new_ledger_id, auth.uid(), 'expense', '기타', 'ellipsis', '#6B746D', 4, true),
    (new_ledger_id, auth.uid(), 'income', '급여', 'wallet-cards', '#2D6A4F', 5, true),
    (new_ledger_id, auth.uid(), 'income', '기타 수입', 'circle-plus', '#0F8B8D', 6, true);

  -- The saving-category trigger runs immediately after the ledger insert.
  -- Move those categories behind expense and income in the global order.
  update public.categories
  set sort_order = sort_order + 7
  where ledger_id = new_ledger_id
    and type = 'saving';

  return new_ledger_id;
end;
$$;

revoke all on function public.create_ledger(text, text, boolean) from public;
grant execute on function public.create_ledger(text, text, boolean) to authenticated;

create or replace function public.create_shared_ledger(ledger_name text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return public.create_ledger(ledger_name, 'shared', false);
end;
$$;

revoke all on function public.create_shared_ledger(text) from public;
grant execute on function public.create_shared_ledger(text) to authenticated;

create or replace function public.rename_ledger(
  p_ledger_id uuid,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_ledger public.ledgers%rowtype;
  normalized_name text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  normalized_name := trim(coalesce(p_name, ''));
  if normalized_name = '' then
    raise exception '가계부 이름을 입력해 주세요.';
  end if;

  if char_length(normalized_name) > 30 then
    raise exception '가계부 이름은 30자 이내로 입력해 주세요.';
  end if;

  if normalized_name ~ '[[:cntrl:]]' then
    raise exception '가계부 이름에 사용할 수 없는 문자가 포함되어 있습니다.';
  end if;

  select *
  into target_ledger
  from public.ledgers
  where id = p_ledger_id;

  if target_ledger.id is null then
    raise exception '가계부를 찾을 수 없습니다.';
  end if;

  if target_ledger.type = 'personal' then
    if target_ledger.owner_id <> auth.uid() then
      raise exception '개인 가계부의 이름을 변경할 권한이 없습니다.';
    end if;
  elsif not public.has_ledger_role(
    p_ledger_id,
    array['owner', 'admin']
  ) then
    raise exception '공동 가계부의 이름을 변경할 권한이 없습니다.';
  end if;

  update public.ledgers
  set name = normalized_name,
      updated_at = now()
  where id = p_ledger_id;
end;
$$;

revoke all on function public.rename_ledger(uuid, text) from public;
grant execute on function public.rename_ledger(uuid, text) to authenticated;
