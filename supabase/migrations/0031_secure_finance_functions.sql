-- Rebuild policies on the encrypted base table so private payment methods are
-- visible and mutable only by their owner.
drop policy if exists "payment_methods_select_member" on public.encrypted_payment_methods;
drop policy if exists "payment_methods_manage_member" on public.encrypted_payment_methods;

create policy "payment_methods_select_by_visibility"
on public.encrypted_payment_methods for select to authenticated
using (
  public.is_ledger_member(ledger_id)
  and (visibility = 'ledger' or owner_user_id = auth.uid())
);

create policy "payment_methods_insert_by_visibility"
on public.encrypted_payment_methods for insert to authenticated
with check (
  public.has_ledger_role(ledger_id, array['owner', 'admin', 'member'])
  and (visibility = 'ledger' or owner_user_id = auth.uid())
);

create policy "payment_methods_update_by_visibility"
on public.encrypted_payment_methods for update to authenticated
using (
  public.has_ledger_role(ledger_id, array['owner', 'admin', 'member'])
  and (visibility = 'ledger' or owner_user_id = auth.uid())
)
with check (
  public.has_ledger_role(ledger_id, array['owner', 'admin', 'member'])
  and (visibility = 'ledger' or owner_user_id = auth.uid())
);

create policy "payment_methods_delete_by_visibility"
on public.encrypted_payment_methods for delete to authenticated
using (
  public.has_ledger_role(ledger_id, array['owner', 'admin', 'member'])
  and (visibility = 'ledger' or owner_user_id = auth.uid())
);

create or replace function public.ensure_user_workspace()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_record auth.users%rowtype;
  default_ledger_id uuid;
  display_name text;
  profile_image text;
  provider_user_id text;
  should_be_default boolean;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into current_user_record from auth.users where id = auth.uid();
  display_name := coalesce(
    nullif(current_user_record.raw_user_meta_data ->> 'name', ''),
    nullif(current_user_record.raw_user_meta_data ->> 'user_name', ''),
    nullif(current_user_record.raw_user_meta_data ->> 'full_name', ''),
    nullif(split_part(coalesce(current_user_record.email, ''), '@', 1), ''),
    '살림온 사용자'
  );
  profile_image := coalesce(
    nullif(current_user_record.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(current_user_record.raw_user_meta_data ->> 'picture', '')
  );
  provider_user_id := nullif(current_user_record.raw_user_meta_data ->> 'sub', '');

  if exists (select 1 from public.profiles where id = auth.uid()) then
    update public.profiles
    set kakao_id = coalesce(provider_user_id, kakao_id),
        nickname = display_name,
        avatar_url = coalesce(profile_image, avatar_url),
        updated_at = now()
    where id = auth.uid();
  else
    insert into public.profiles (id, kakao_id, nickname, avatar_url)
    values (auth.uid(), provider_user_id, display_name, profile_image);
  end if;

  select id into default_ledger_id
  from public.ledgers
  where owner_id = auth.uid() and type = 'personal'
  order by created_at
  limit 1;

  if default_ledger_id is null then
    insert into public.ledgers (owner_id, name, type, currency)
    values (auth.uid(), '내 가계부', 'personal', 'KRW')
    returning id into default_ledger_id;

    insert into public.categories (
      ledger_id, created_by, type, name, icon, color, sort_order, is_default
    ) values
      (default_ledger_id, auth.uid(), 'expense', '식비', 'utensils', '#E4572E', 0, true),
      (default_ledger_id, auth.uid(), 'expense', '카페/간식', 'coffee', '#F3A712', 1, true),
      (default_ledger_id, auth.uid(), 'expense', '교통', 'bus', '#2D6A4F', 2, true),
      (default_ledger_id, auth.uid(), 'expense', '생활', 'shopping-basket', '#0F8B8D', 3, true),
      (default_ledger_id, auth.uid(), 'expense', '기타', 'ellipsis', '#6B746D', 4, true),
      (default_ledger_id, auth.uid(), 'income', '급여', 'wallet-cards', '#2D6A4F', 5, true),
      (default_ledger_id, auth.uid(), 'income', '기타 수입', 'circle-plus', '#0F8B8D', 6, true);
  end if;

  should_be_default := not exists (
    select 1 from public.ledger_members
    where user_id = auth.uid() and status = 'active' and is_default
  );

  if exists (
    select 1 from public.ledger_members
    where ledger_id = default_ledger_id and user_id = auth.uid()
  ) then
    update public.ledger_members
    set nickname = display_name, role = 'owner', status = 'active',
        removed_at = null,
        is_default = case when should_be_default then true else is_default end
    where ledger_id = default_ledger_id and user_id = auth.uid();
  else
    insert into public.ledger_members (
      ledger_id, user_id, nickname, role, status, is_default
    ) values (
      default_ledger_id, auth.uid(), display_name, 'owner', 'active',
      should_be_default
    );
  end if;

  return default_ledger_id;
end;
$$;

revoke all on function public.ensure_user_workspace() from public;
grant execute on function public.ensure_user_workspace() to authenticated;

create or replace function public.set_default_ledger(p_ledger_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (
    select 1 from public.encrypted_ledger_members
    where ledger_id = p_ledger_id and user_id = auth.uid()
      and status = 'active'
  ) then
    raise exception '참여 중인 가계부만 기본으로 설정할 수 있습니다.';
  end if;

  update public.encrypted_ledger_members
  set is_default = (ledger_id = p_ledger_id)
  where user_id = auth.uid() and status = 'active'
    and (is_default or ledger_id = p_ledger_id);
end;
$$;

revoke all on function public.set_default_ledger(uuid) from public;
grant execute on function public.set_default_ledger(uuid) to authenticated;

alter table public.ledger_invitations
  drop constraint if exists ledger_invitations_invite_code_key;

update public.ledger_invitations
set status = 'revoked', invite_code = ''
where status = 'active';

create table if not exists private.invite_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null default false
);
revoke all on private.invite_attempts from public, anon, authenticated;

create index if not exists invite_attempts_user_time_idx
on private.invite_attempts (user_id, attempted_at desc);

create or replace function public.create_ledger_invite(p_ledger_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  generated_code text;
  generated_hash text;
  invitation_id uuid;
  expiration timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not public.has_ledger_role(p_ledger_id, array['owner', 'admin']) then
    raise exception '초대를 만들 권한이 없습니다.';
  end if;

  loop
    generated_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 8));
    generated_hash := private.blind_index('invite|' || generated_code);
    exit when not exists (
      select 1 from public.ledger_invitations
      where invite_token_hash = generated_hash
    );
  end loop;

  insert into public.ledger_invitations (
    ledger_id, invited_by, invite_code, invite_token_hash, role_to_grant,
    status, expires_at
  ) values (
    p_ledger_id, auth.uid(), '', generated_hash, 'member', 'active', expiration
  ) returning id into invitation_id;

  return jsonb_build_object(
    'id', invitation_id,
    'inviteCode', generated_code,
    'expiresAt', expiration
  );
end;
$$;

revoke all on function public.create_ledger_invite(uuid) from public;
grant execute on function public.create_ledger_invite(uuid) to authenticated;

create or replace function public.accept_ledger_invite(submitted_code text)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  invitation public.ledger_invitations%rowtype;
  display_name text;
  submitted_hash text;
  recent_attempts int;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;

  delete from private.invite_attempts
  where attempted_at < now() - interval '1 day';

  select count(*) into recent_attempts
  from private.invite_attempts
  where user_id = auth.uid() and attempted_at >= now() - interval '10 minutes';

  if recent_attempts >= 10 then
    raise exception '초대 코드 확인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  end if;

  insert into private.invite_attempts (user_id, succeeded)
  values (auth.uid(), false);

  submitted_hash := private.blind_index('invite|' || upper(trim(submitted_code)));
  select * into invitation
  from public.ledger_invitations
  where invite_token_hash = submitted_hash
  for update;

  if invitation.id is null
    or invitation.status <> 'active'
    or invitation.expires_at <= now()
    or invitation.used_count >= invitation.max_uses then
    return null;
  end if;

  if exists (
    select 1 from public.ledger_members
    where ledger_id = invitation.ledger_id
      and user_id = auth.uid() and status = 'active'
  ) then
    return null;
  end if;

  select nickname into display_name from public.profiles where id = auth.uid();
  if exists (
    select 1 from public.ledger_members
    where ledger_id = invitation.ledger_id and user_id = auth.uid()
  ) then
    update public.encrypted_ledger_members
    set nickname = '', role = invitation.role_to_grant, status = 'active',
        removed_at = null,
        private_payload = private.encrypt_payload(jsonb_build_object(
          'nickname', coalesce(display_name, '공동 멤버')
        )),
        encryption_key_version = 1
    where ledger_id = invitation.ledger_id and user_id = auth.uid();
  else
    insert into public.encrypted_ledger_members (
      ledger_id, user_id, nickname, role, status, removed_at,
      private_payload, encryption_key_version
    ) values (
      invitation.ledger_id, auth.uid(), '', invitation.role_to_grant,
      'active', null,
      private.encrypt_payload(jsonb_build_object(
        'nickname', coalesce(display_name, '공동 멤버')
      )), 1
    );
  end if;

  update public.ledger_invitations
  set used_count = used_count + 1,
      status = case when used_count + 1 >= max_uses then 'accepted' else status end,
      accepted_at = now(), accepted_by = auth.uid()
  where id = invitation.id;

  update private.invite_attempts
  set succeeded = true
  where id = (
    select id from private.invite_attempts
    where user_id = auth.uid()
    order by attempted_at desc, id desc limit 1
  );

  return invitation.ledger_id;
end;
$$;

revoke all on function public.accept_ledger_invite(text) from public;
grant execute on function public.accept_ledger_invite(text) to authenticated;

create or replace function public.set_secure_category_budget(
  p_ledger_id uuid,
  p_category_id uuid,
  p_effective_month date,
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  budget_id uuid;
  month_index text;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not public.has_ledger_role(p_ledger_id, array['owner', 'admin', 'member']) then
    raise exception '예산을 저장할 권한이 없습니다.';
  end if;
  if p_amount < 0 then raise exception '예산은 0 이상이어야 합니다.'; end if;
  if extract(day from p_effective_month) <> 1 then
    raise exception '예산 적용 월은 매월 1일이어야 합니다.';
  end if;

  month_index := private.blind_index(
    p_category_id::text || '|' || p_effective_month::text
  );
  select id into budget_id
  from public.encrypted_category_budgets
  where category_id = p_category_id
    and effective_month_blind_index = month_index
  for update;

  if budget_id is null then
    insert into public.category_budgets (
      ledger_id, category_id, effective_month, amount, created_by
    ) values (
      p_ledger_id, p_category_id, p_effective_month, p_amount, auth.uid()
    ) returning id into budget_id;
  else
    update public.category_budgets
    set effective_month = p_effective_month, amount = p_amount
    where id = budget_id;
  end if;
  return budget_id;
end;
$$;

revoke all on function public.set_secure_category_budget(uuid, uuid, date, numeric)
from public;
grant execute on function public.set_secure_category_budget(uuid, uuid, date, numeric)
to authenticated;

drop function if exists public.convert_personal_ledger_to_shared(uuid);
create or replace function public.convert_personal_ledger_to_shared(
  p_ledger_id uuid,
  p_shared_payment_method_ids uuid[] default array[]::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (
    select 1 from public.ledgers
    where id = p_ledger_id and owner_id = auth.uid() and type = 'personal'
  ) then
    raise exception '소유한 개인 가계부만 공동으로 전환할 수 있습니다.';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_shared_payment_method_ids, array[]::uuid[])) id
    where not exists (
      select 1 from public.payment_methods p
      where p.id = id and p.ledger_id = p_ledger_id
        and p.owner_user_id = auth.uid()
    )
  ) then
    raise exception '공개할 수 없는 카드 또는 계좌가 포함되어 있습니다.';
  end if;

  update public.payment_methods
  set visibility = case
    when id = any(coalesce(p_shared_payment_method_ids, array[]::uuid[]))
      then 'ledger'
    else 'private'
  end
  where ledger_id = p_ledger_id;

  update public.ledgers set type = 'shared', updated_at = now()
  where id = p_ledger_id;
end;
$$;

revoke all on function public.convert_personal_ledger_to_shared(uuid, uuid[]) from public;
grant execute on function public.convert_personal_ledger_to_shared(uuid, uuid[])
to authenticated;

create or replace function public.save_card_installment_series_v2(
  p_rule_id uuid,
  p_ledger_id uuid,
  p_amount numeric,
  p_amount_type text,
  p_transaction_at timestamptz,
  p_installment_months int,
  p_category_id uuid,
  p_merchant_name text,
  p_memo text,
  p_actor_user_id uuid,
  p_status text,
  p_type text,
  p_payment_method_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  card public.payment_methods%rowtype;
  installment_rule_id uuid;
  rule_owner uuid;
  existing_transaction_id uuid;
  occurrence_no int;
  occurrence_at timestamptz;
  occurrence_amount numeric(14, 2);
  monthly_amount numeric(14, 2);
  principal_amount numeric(14, 2);
  local_purchase timestamp := timezone('Asia/Seoul', p_transaction_at);
  payment_month date := date_trunc('month', local_purchase)::date;
  cutoff_month date;
  cutoff_date date;
  first_payment_local timestamp;
  first_payment_at timestamptz;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not public.has_ledger_role(p_ledger_id, array['owner', 'admin', 'member']) then
    raise exception '할부 거래를 저장할 권한이 없습니다.';
  end if;
  if p_amount <= 0 then raise exception '금액은 0보다 커야 합니다.'; end if;
  if p_installment_months not between 2 and 120 then
    raise exception '할부 개월은 2개월에서 120개월 사이여야 합니다.';
  end if;
  if p_amount_type not in ('monthly', 'principal') then
    raise exception '올바르지 않은 할부 금액 유형입니다.';
  end if;
  if p_amount_type = 'principal' and p_amount < p_installment_months then
    raise exception '할부 원금은 할부 개월 수 이상이어야 합니다.';
  end if;
  if p_status not in ('pending', 'confirmed', 'excluded') then
    raise exception '올바르지 않은 거래 상태입니다.';
  end if;
  if p_type <> 'expense' then
    raise exception '할부는 지출 거래에만 설정할 수 있습니다.';
  end if;

  select * into card
  from public.payment_methods
  where id = p_payment_method_id and ledger_id = p_ledger_id
    and type = 'card' and is_active and deleted_at is null
    and (visibility = 'ledger' or owner_user_id = auth.uid());

  if card.id is null or card.payment_day is null
    or card.billing_period_end_day is null
    or card.billing_period_end_month_offset is null then
    raise exception '청구주기가 등록된 카드를 선택해 주세요.';
  end if;

  monthly_amount := case
    when p_amount_type = 'principal' then floor(p_amount / p_installment_months)
    else p_amount
  end;
  principal_amount := case
    when p_amount_type = 'principal' then p_amount
    else p_amount * p_installment_months
  end;

  cutoff_month := (
    payment_month + make_interval(months => card.billing_period_end_month_offset)
  )::date;
  cutoff_date := make_date(
    extract(year from cutoff_month)::int,
    extract(month from cutoff_month)::int,
    least(card.billing_period_end_day,
      extract(day from (date_trunc('month', cutoff_month)
        + interval '1 month - 1 day'))::int)
  );
  if local_purchase::date > cutoff_date then
    payment_month := (payment_month + interval '1 month')::date;
  end if;

  first_payment_local := make_date(
    extract(year from payment_month)::int,
    extract(month from payment_month)::int,
    least(card.payment_day,
      extract(day from (date_trunc('month', payment_month)
        + interval '1 month - 1 day'))::int)
  ) + local_purchase::time;
  first_payment_at := first_payment_local at time zone 'Asia/Seoul';

  if p_rule_id is null then
    insert into public.recurring_rules (
      ledger_id, created_by, rule_type, amount, day_of_month, time_of_day,
      start_month, end_month, installment_months, installment_amount_type,
      installment_principal, purchase_at, payment_method_id, category_id,
      merchant_name, memo, transaction_type, transaction_status,
      actor_user_id, is_active
    ) values (
      p_ledger_id, auth.uid(), 'installment', monthly_amount,
      extract(day from timezone('Asia/Seoul', first_payment_at))::int,
      timezone('Asia/Seoul', first_payment_at)::time,
      date_trunc('month', timezone('Asia/Seoul', first_payment_at))::date,
      (date_trunc('month', timezone('Asia/Seoul', first_payment_at))
        + make_interval(months => p_installment_months - 1))::date,
      p_installment_months, p_amount_type, principal_amount, p_transaction_at,
      p_payment_method_id, p_category_id, p_merchant_name, p_memo, p_type,
      p_status, p_actor_user_id, true
    ) returning id, created_by into installment_rule_id, rule_owner;
  else
    select id, created_by into installment_rule_id, rule_owner
    from public.recurring_rules
    where id = p_rule_id and ledger_id = p_ledger_id
      and rule_type = 'installment';
    if installment_rule_id is null then
      raise exception '할부 규칙을 찾을 수 없습니다.';
    end if;

    update public.recurring_rules
    set amount = monthly_amount,
        day_of_month = extract(day from timezone('Asia/Seoul', first_payment_at))::int,
        time_of_day = timezone('Asia/Seoul', first_payment_at)::time,
        start_month = date_trunc('month', timezone('Asia/Seoul', first_payment_at))::date,
        end_month = (date_trunc('month', timezone('Asia/Seoul', first_payment_at))
          + make_interval(months => p_installment_months - 1))::date,
        inactive_from_month = null, installment_months = p_installment_months,
        installment_amount_type = p_amount_type,
        installment_principal = principal_amount, purchase_at = p_transaction_at,
        payment_method_id = p_payment_method_id, category_id = p_category_id,
        merchant_name = p_merchant_name, memo = p_memo,
        transaction_type = p_type, transaction_status = p_status,
        actor_user_id = p_actor_user_id, is_active = true, updated_at = now()
    where id = installment_rule_id;
  end if;

  for occurrence_no in 1..p_installment_months loop
    occurrence_at := first_payment_at + make_interval(months => occurrence_no - 1);
    occurrence_amount := case
      when p_amount_type = 'principal' and occurrence_no = p_installment_months
        then principal_amount - monthly_amount * (p_installment_months - 1)
      else monthly_amount
    end;

    select id into existing_transaction_id
    from public.transactions
    where recurring_rule_id = installment_rule_id
      and installment_number = occurrence_no and deleted_at is null
    limit 1;

    if existing_transaction_id is null then
      insert into public.transactions (
        ledger_id, created_by, updated_by, actor_user_id, type, status, amount,
        currency, transaction_at, category_id, payment_method_id, merchant_name,
        memo, source_type, recurring_rule_id, recurring_type,
        installment_number, installment_total
      ) values (
        p_ledger_id, rule_owner, auth.uid(), p_actor_user_id, p_type, p_status,
        occurrence_amount, 'KRW', occurrence_at, p_category_id,
        p_payment_method_id, p_merchant_name, p_memo, 'manual',
        installment_rule_id, 'installment', occurrence_no, p_installment_months
      );
    else
      update public.transactions
      set updated_by = auth.uid(), actor_user_id = p_actor_user_id,
          type = p_type, status = p_status, amount = occurrence_amount,
          transaction_at = occurrence_at, category_id = p_category_id,
          payment_method_id = p_payment_method_id,
          merchant_name = p_merchant_name, memo = p_memo,
          installment_total = p_installment_months, updated_at = now()
      where id = existing_transaction_id;
    end if;
  end loop;

  update public.transactions
  set deleted_at = now(), updated_by = auth.uid(), updated_at = now()
  where recurring_rule_id = installment_rule_id and deleted_at is null
    and installment_number > p_installment_months;

  return installment_rule_id;
end;
$$;

revoke all on function public.save_card_installment_series_v2(
  uuid, uuid, numeric, text, timestamptz, int, uuid, text, text, uuid,
  text, text, uuid
) from public;
grant execute on function public.save_card_installment_series_v2(
  uuid, uuid, numeric, text, timestamptz, int, uuid, text, text, uuid,
  text, text, uuid
) to authenticated;

create or replace function public.materialize_finance_month(target_month date)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  rule public.recurring_rules%rowtype;
  month_start date := date_trunc('month', target_month)::date;
  occurrence_no int;
  occurrence_date date;
  occurrence_amount numeric(14, 2);
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;

  for rule in
    select * from public.recurring_rules r
    where public.is_ledger_member(r.ledger_id)
      and r.start_month <= month_start
      and (r.end_month is null or r.end_month >= month_start)
      and (r.inactive_from_month is null or r.inactive_from_month > month_start)
  loop
    occurrence_no := (
      (extract(year from month_start)::int - extract(year from rule.start_month)::int) * 12
      + extract(month from month_start)::int
      - extract(month from rule.start_month)::int
    ) + 1;
    if rule.rule_type = 'installment'
      and occurrence_no > coalesce(rule.installment_months, 0) then
      continue;
    end if;
    if exists (
      select 1 from public.transactions txn
      where txn.recurring_rule_id = rule.id
        and txn.installment_number = occurrence_no
    ) then
      continue;
    end if;

    occurrence_date := make_date(
      extract(year from month_start)::int,
      extract(month from month_start)::int,
      least(rule.day_of_month,
        extract(day from (month_start + interval '1 month - 1 day'))::int)
    );
    occurrence_amount := case
      when rule.rule_type = 'installment'
        and rule.installment_amount_type = 'principal'
        and occurrence_no = rule.installment_months
        then rule.installment_principal - rule.amount * (rule.installment_months - 1)
      else rule.amount
    end;

    insert into public.encrypted_transactions (
      ledger_id, created_by, updated_by, actor_user_id, type, status, amount,
      currency, transaction_at, category_id, payment_method_id, merchant_name,
      memo, source_type, recurring_rule_id, recurring_type,
      installment_number, installment_total, private_payload,
      encryption_key_version
    ) values (
      rule.ledger_id, rule.created_by, rule.created_by, rule.actor_user_id,
      rule.transaction_type, rule.transaction_status, 0, 'KRW',
      '1970-01-01 00:00:00+00', rule.category_id,
      rule.payment_method_id, null, null, 'manual', rule.id,
      rule.rule_type, occurrence_no,
      case when rule.rule_type = 'installment' then rule.installment_months else null end,
      private.encrypt_payload(jsonb_strip_nulls(jsonb_build_object(
        'amount', occurrence_amount,
        'transaction_at', occurrence_date + rule.time_of_day,
        'merchant_name', rule.merchant_name,
        'memo', rule.memo
      ))), 1
    );
  end loop;
end;
$$;

revoke all on function public.materialize_finance_month(date) from public;
grant execute on function public.materialize_finance_month(date) to authenticated;
