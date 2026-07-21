-- Income classification is separate from recurrence. Existing income is
-- conservatively treated as side income because historic salary intent cannot
-- be inferred safely from an editable category name.

alter table public.encrypted_transactions
  add column income_kind text;

alter table public.encrypted_recurring_rules
  add column income_kind text;

update public.encrypted_transactions
set income_kind = 'side_income'
where type = 'income';

update public.encrypted_recurring_rules
set income_kind = 'side_income'
where transaction_type = 'income';

alter table public.encrypted_transactions
  add constraint encrypted_transactions_income_kind_check check (
    (type = 'income' and income_kind in ('salary', 'side_income'))
    or (type <> 'income' and income_kind is null)
  ),
  add constraint encrypted_transactions_salary_recurrence_check check (
    income_kind is distinct from 'salary' or recurring_type = 'fixed'
  );

alter table public.encrypted_recurring_rules
  add constraint encrypted_recurring_rules_income_kind_check check (
    (transaction_type = 'income' and income_kind in ('salary', 'side_income'))
    or (transaction_type <> 'income' and income_kind is null)
  ),
  add constraint encrypted_recurring_rules_salary_recurrence_check check (
    income_kind is distinct from 'salary' or rule_type = 'fixed'
  );

create or replace view public.transactions
with (security_invoker = true)
as
select
  transaction.id,
  transaction.ledger_id,
  transaction.created_by,
  transaction.updated_by,
  transaction.type,
  transaction.status,
  (data.payload ->> 'amount')::numeric as amount,
  transaction.currency,
  (data.payload ->> 'transaction_at')::timestamptz as transaction_at,
  transaction.category_id,
  transaction.payment_method_id,
  data.payload ->> 'merchant_name' as merchant_name,
  data.payload ->> 'memo' as memo,
  transaction.source_type,
  data.payload ->> 'source_app' as source_app,
  data.payload ->> 'source_sender' as source_sender,
  transaction.source_hash,
  transaction.parse_confidence,
  transaction.created_at,
  transaction.updated_at,
  transaction.deleted_at,
  transaction.actor_user_id,
  transaction.recurring_rule_id,
  transaction.recurring_type,
  transaction.installment_number,
  transaction.installment_total,
  coalesce(
    array(
      select jsonb_array_elements_text(
        coalesce(data.payload -> 'tags', '[]'::jsonb)
      )
    ),
    array[]::text[]
  ) as tags,
  transaction.income_kind
from public.encrypted_transactions transaction
cross join lateral (
  select private.decrypt_payload(transaction.private_payload) as payload
) data;

create or replace function private.write_transactions_view()
returns trigger language plpgsql security definer
set search_path = private, public, pg_catalog as $$
declare
  private_data jsonb;
  normalized_tags text[];
begin
  if tg_op = 'DELETE' then
    delete from public.encrypted_transactions where id = old.id;
    return old;
  end if;

  if (tg_op = 'INSERT' or new.payment_method_id is distinct from old.payment_method_id)
    and new.payment_method_id is not null
    and not exists (
      select 1 from public.payment_methods method
      where method.id = new.payment_method_id and method.ledger_id = new.ledger_id
    ) then
    raise exception '사용할 수 없는 결제수단입니다.';
  end if;
  if new.amount is null or new.amount <= 0 then
    raise exception '금액은 0보다 커야 합니다.';
  end if;
  if new.transaction_at is null then
    raise exception '거래 일시가 필요합니다.';
  end if;
  new.income_kind := case
    when new.type = 'income' then coalesce(new.income_kind, 'side_income')
    else null
  end;
  if (new.type = 'income' and new.income_kind not in ('salary', 'side_income'))
    or (new.type <> 'income' and new.income_kind is not null) then
    raise exception '수입 유형을 확인해 주세요.';
  end if;
  if new.income_kind = 'salary' and new.recurring_type is distinct from 'fixed' then
    raise exception '월급은 고정수입으로만 등록할 수 있습니다.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(new.tags, array[]::text[])) tag
    where char_length(trim(tag)) > 20
  ) then
    raise exception '태그는 20자 이내로 입력해 주세요.';
  end if;
  select coalesce(array_agg(distinct trim(tag)), array[]::text[])
  into normalized_tags
  from unnest(coalesce(new.tags, array[]::text[])) tag
  where trim(tag) <> '' and char_length(trim(tag)) <= 20;
  if cardinality(normalized_tags) > 10 then
    raise exception '태그는 최대 10개까지 저장할 수 있습니다.';
  end if;

  private_data := jsonb_strip_nulls(jsonb_build_object(
    'amount', new.amount, 'transaction_at', new.transaction_at,
    'merchant_name', new.merchant_name, 'memo', new.memo,
    'source_app', new.source_app, 'source_sender', new.source_sender,
    'tags', to_jsonb(normalized_tags)
  ));

  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid());
    new.status := coalesce(new.status, 'confirmed');
    new.currency := coalesce(new.currency, 'KRW');
    new.source_type := coalesce(new.source_type, 'manual');
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());
    insert into public.encrypted_transactions (
      id, ledger_id, created_by, updated_by, type, status, amount, currency,
      transaction_at, category_id, payment_method_id, merchant_name, memo,
      source_type, source_app, source_sender, source_hash, parse_confidence,
      created_at, updated_at, deleted_at, actor_user_id, recurring_rule_id,
      recurring_type, installment_number, installment_total, private_payload,
      encryption_key_version, income_kind
    ) values (
      new.id, new.ledger_id, new.created_by, new.updated_by, new.type,
      new.status, 0, new.currency, '1970-01-01 00:00:00+00', new.category_id,
      new.payment_method_id, null, null, new.source_type, null, null,
      private.blind_index(new.source_hash), new.parse_confidence,
      new.created_at, new.updated_at, new.deleted_at, new.actor_user_id,
      new.recurring_rule_id, new.recurring_type, new.installment_number,
      new.installment_total, private.encrypt_payload(private_data), 1,
      new.income_kind
    );
    new.source_hash := private.blind_index(new.source_hash);
    new.tags := normalized_tags;
    return new;
  else
    new.id := old.id;
    update public.encrypted_transactions
    set ledger_id = new.ledger_id, created_by = new.created_by,
        updated_by = new.updated_by, type = new.type, status = new.status,
        currency = new.currency, category_id = new.category_id,
        payment_method_id = new.payment_method_id, source_type = new.source_type,
        source_hash = case
          when new.source_hash is distinct from old.source_hash
            then private.blind_index(new.source_hash)
          else source_hash
        end,
        parse_confidence = new.parse_confidence,
        updated_at = coalesce(new.updated_at, now()), deleted_at = new.deleted_at,
        actor_user_id = new.actor_user_id,
        recurring_rule_id = new.recurring_rule_id,
        recurring_type = new.recurring_type,
        installment_number = new.installment_number,
        installment_total = new.installment_total,
        income_kind = new.income_kind,
        private_payload = private.encrypt_payload(private_data),
        encryption_key_version = 1
    where id = old.id;
    new.tags := normalized_tags;
    return new;
  end if;
end;
$$;

alter function private.write_transactions_view() owner to salimon_crypto_writer;

create or replace view public.recurring_rules
with (security_invoker = true)
as
select
  rule.id,
  rule.ledger_id,
  rule.created_by,
  rule.rule_type,
  (data.payload ->> 'amount')::numeric as amount,
  (data.payload ->> 'day_of_month')::int as day_of_month,
  (data.payload ->> 'time_of_day')::time as time_of_day,
  (data.payload ->> 'start_month')::date as start_month,
  (data.payload ->> 'end_month')::date as end_month,
  (data.payload ->> 'inactive_from_month')::date as inactive_from_month,
  (data.payload ->> 'installment_months')::int as installment_months,
  rule.category_id,
  data.payload ->> 'merchant_name' as merchant_name,
  data.payload ->> 'memo' as memo,
  rule.is_active,
  rule.created_at,
  rule.updated_at,
  rule.transaction_type,
  rule.transaction_status,
  rule.actor_user_id,
  (data.payload ->> 'purchase_at')::timestamptz as purchase_at,
  rule.payment_method_id,
  rule.installment_amount_type,
  (data.payload ->> 'installment_principal')::numeric as installment_principal,
  rule.income_kind
from public.encrypted_recurring_rules rule
cross join lateral (
  select private.decrypt_payload(rule.private_payload) as payload
) data;

create or replace function private.write_recurring_rules_view()
returns trigger language plpgsql security definer
set search_path = private, public, pg_catalog as $$
declare
  private_data jsonb;
begin
  if tg_op = 'DELETE' then
    delete from public.encrypted_recurring_rules where id = old.id;
    return old;
  end if;

  if (tg_op = 'INSERT' or new.payment_method_id is distinct from old.payment_method_id)
    and new.payment_method_id is not null
    and not exists (
      select 1 from public.payment_methods method
      where method.id = new.payment_method_id and method.ledger_id = new.ledger_id
    ) then
    raise exception '사용할 수 없는 결제수단입니다.';
  end if;
  if new.amount is null or new.amount <= 0 then
    raise exception '반복 금액은 0보다 커야 합니다.';
  end if;
  if new.day_of_month is null or new.day_of_month not between 1 and 31 then
    raise exception '반복 일자는 1일부터 31일 사이여야 합니다.';
  end if;
  if new.start_month is null then
    raise exception '반복 시작 월이 필요합니다.';
  end if;
  new.income_kind := case
    when new.transaction_type = 'income'
      then coalesce(new.income_kind, 'side_income')
    else null
  end;
  if (new.transaction_type = 'income' and new.income_kind not in ('salary', 'side_income'))
    or (new.transaction_type <> 'income' and new.income_kind is not null) then
    raise exception '수입 유형을 확인해 주세요.';
  end if;
  if new.income_kind = 'salary' and new.rule_type is distinct from 'fixed' then
    raise exception '월급은 고정수입으로만 등록할 수 있습니다.';
  end if;

  private_data := jsonb_strip_nulls(jsonb_build_object(
    'amount', new.amount, 'day_of_month', new.day_of_month,
    'time_of_day', coalesce(new.time_of_day, '12:00'::time),
    'start_month', new.start_month, 'end_month', new.end_month,
    'inactive_from_month', new.inactive_from_month,
    'installment_months', new.installment_months,
    'merchant_name', new.merchant_name, 'memo', new.memo,
    'purchase_at', new.purchase_at,
    'installment_principal', new.installment_principal
  ));

  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid());
    new.time_of_day := coalesce(new.time_of_day, '12:00'::time);
    new.is_active := coalesce(new.is_active, true);
    new.transaction_type := coalesce(new.transaction_type, 'expense');
    new.transaction_status := coalesce(new.transaction_status, 'confirmed');
    new.installment_amount_type := coalesce(new.installment_amount_type, 'monthly');
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());
    insert into public.encrypted_recurring_rules (
      id, ledger_id, created_by, rule_type, amount, day_of_month, time_of_day,
      start_month, end_month, inactive_from_month, installment_months,
      category_id, merchant_name, memo, is_active, created_at, updated_at,
      transaction_type, transaction_status, actor_user_id, purchase_at,
      payment_method_id, installment_amount_type, installment_principal,
      private_payload, encryption_key_version, income_kind
    ) values (
      new.id, new.ledger_id, new.created_by, new.rule_type, 1, 1, '00:00',
      '1970-01-01', null, null, null, new.category_id, null, null,
      new.is_active, new.created_at, new.updated_at, new.transaction_type,
      new.transaction_status, new.actor_user_id, null, new.payment_method_id,
      new.installment_amount_type, null, private.encrypt_payload(private_data), 1,
      new.income_kind
    );
    return new;
  else
    new.id := old.id;
    update public.encrypted_recurring_rules
    set ledger_id = new.ledger_id, created_by = new.created_by,
        rule_type = new.rule_type, category_id = new.category_id,
        is_active = new.is_active, updated_at = coalesce(new.updated_at, now()),
        transaction_type = new.transaction_type,
        transaction_status = new.transaction_status,
        actor_user_id = new.actor_user_id,
        payment_method_id = new.payment_method_id,
        installment_amount_type = new.installment_amount_type,
        income_kind = new.income_kind,
        private_payload = private.encrypt_payload(private_data),
        encryption_key_version = 1
    where id = old.id;
    return new;
  end if;
end;
$$;

alter function private.write_recurring_rules_view() owner to salimon_crypto_writer;

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
    select * from public.recurring_rules recurring_rule
    where public.is_ledger_member(recurring_rule.ledger_id)
      and recurring_rule.start_month <= month_start
      and (recurring_rule.end_month is null or recurring_rule.end_month >= month_start)
      and (
        recurring_rule.inactive_from_month is null
        or recurring_rule.inactive_from_month > month_start
      )
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
      select 1 from public.transactions transaction
      where transaction.recurring_rule_id = rule.id
        and transaction.installment_number = occurrence_no
    ) then
      continue;
    end if;

    occurrence_date := make_date(
      extract(year from month_start)::int,
      extract(month from month_start)::int,
      least(
        rule.day_of_month,
        extract(day from (month_start + interval '1 month - 1 day'))::int
      )
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
      encryption_key_version, income_kind
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
      ))), 1, rule.income_kind
    );
  end loop;
end;
$$;

create or replace function public.update_transaction_with_recurrence_v3(
  p_transaction_id uuid,
  p_ledger_id uuid,
  p_amount numeric,
  p_transaction_at timestamptz,
  p_category_id uuid,
  p_merchant_name text,
  p_memo text,
  p_actor_user_id uuid,
  p_status text,
  p_type text,
  p_income_kind text,
  p_payment_method_id uuid,
  p_recurring_type text,
  p_installment_months int,
  p_installment_amount_type text,
  p_apply_changes_to_future boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  original public.transactions%rowtype;
  target_recurring_type text := nullif(p_recurring_type, 'none');
  cutoff_month date;
  saved_rule_id uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if p_type = 'income' and p_income_kind not in ('salary', 'side_income') then
    raise exception '수입 유형을 확인해 주세요.';
  end if;
  if p_type <> 'income' and p_income_kind is not null then
    raise exception '수입 거래에만 수입 유형을 설정할 수 있습니다.';
  end if;
  if p_income_kind = 'salary' and target_recurring_type is distinct from 'fixed' then
    raise exception '월급은 고정수입으로만 등록할 수 있습니다.';
  end if;

  select * into original
  from public.transactions
  where id = p_transaction_id
    and ledger_id = p_ledger_id
    and deleted_at is null
  for update;

  if original.id is null then raise exception '수정할 거래를 찾을 수 없습니다.'; end if;
  if not public.has_ledger_role(
    p_ledger_id,
    array['owner', 'admin', 'member']
  ) then
    raise exception '거래를 수정할 권한이 없습니다.';
  end if;

  if original.recurring_type = 'fixed' then
    if target_recurring_type is distinct from 'fixed' then
      raise exception '고정 거래의 반복 여부는 반복 종료 기능으로 변경해 주세요.';
    end if;
    if p_type is distinct from original.type
      or p_income_kind is distinct from original.income_kind then
      raise exception '고정 거래의 거래 유형은 변경할 수 없습니다.';
    end if;
    if p_transaction_at is distinct from original.transaction_at then
      raise exception '고정 거래의 거래 일시는 변경할 수 없습니다.';
    end if;

    cutoff_month := date_trunc(
      'month',
      timezone('Asia/Seoul', original.transaction_at)
    )::date;

    if coalesce(p_apply_changes_to_future, true) then
      update public.recurring_rules
      set amount = p_amount,
          category_id = p_category_id,
          payment_method_id = p_payment_method_id,
          merchant_name = p_merchant_name,
          memo = p_memo,
          transaction_status = p_status,
          actor_user_id = p_actor_user_id,
          updated_at = now()
      where id = original.recurring_rule_id
        and ledger_id = p_ledger_id
        and rule_type = 'fixed';

      update public.transactions
      set amount = p_amount,
          category_id = p_category_id,
          payment_method_id = p_payment_method_id,
          merchant_name = p_merchant_name,
          memo = p_memo,
          status = p_status,
          actor_user_id = p_actor_user_id,
          updated_by = auth.uid(),
          updated_at = now()
      where recurring_rule_id = original.recurring_rule_id
        and deleted_at is null
        and timezone('Asia/Seoul', transaction_at)::date >= cutoff_month;
    else
      update public.transactions
      set amount = p_amount,
          category_id = p_category_id,
          payment_method_id = p_payment_method_id,
          merchant_name = p_merchant_name,
          memo = p_memo,
          status = p_status,
          actor_user_id = p_actor_user_id,
          updated_by = auth.uid(),
          updated_at = now()
      where id = original.id;
    end if;

    return original.recurring_rule_id;
  end if;

  saved_rule_id := public.update_transaction_with_recurrence_v2(
    p_transaction_id,
    p_ledger_id,
    p_amount,
    p_transaction_at,
    p_category_id,
    p_merchant_name,
    p_memo,
    p_actor_user_id,
    p_status,
    p_type,
    p_payment_method_id,
    p_recurring_type,
    p_installment_months,
    p_installment_amount_type,
    p_apply_changes_to_future
  );

  if saved_rule_id is not null and target_recurring_type = 'fixed' then
    update public.recurring_rules
    set income_kind = p_income_kind, updated_at = now()
    where id = saved_rule_id and ledger_id = p_ledger_id;

    update public.transactions
    set income_kind = p_income_kind, updated_by = auth.uid(), updated_at = now()
    where recurring_rule_id = saved_rule_id and deleted_at is null;
  else
    update public.transactions
    set income_kind = p_income_kind, updated_by = auth.uid(), updated_at = now()
    where id = p_transaction_id and deleted_at is null;
  end if;

  return saved_rule_id;
end;
$$;

revoke all on function public.update_transaction_with_recurrence_v3(
  uuid, uuid, numeric, timestamptz, uuid, text, text, uuid, text, text, text,
  uuid, text, int, text, boolean
) from public;
grant execute on function public.update_transaction_with_recurrence_v3(
  uuid, uuid, numeric, timestamptz, uuid, text, text, uuid, text, text, text,
  uuid, text, int, text, boolean
) to authenticated;
