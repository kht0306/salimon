-- Keep the exact transaction timestamp encrypted while making month-scoped
-- calendar loads indexable. The blind index cannot be reversed into a month.

alter table public.encrypted_transactions
  add column if not exists transaction_month_blind_index text;

update public.encrypted_transactions
set transaction_month_blind_index = private.blind_index(
  to_char(
    (
      (private.decrypt_payload(private_payload) ->> 'transaction_at')::timestamptz
      at time zone 'Asia/Seoul'
    ),
    'YYYY-MM'
  )
)
where transaction_month_blind_index is null;

alter table public.encrypted_transactions
  alter column transaction_month_blind_index set not null;

create index if not exists encrypted_transactions_month_active_idx
on public.encrypted_transactions (transaction_month_blind_index)
where deleted_at is null;

create or replace function private.sync_transaction_month_blind_index()
returns trigger
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
begin
  new.transaction_month_blind_index := private.blind_index(
    to_char(
      (
        (private.decrypt_payload(new.private_payload) ->> 'transaction_at')::timestamptz
        at time zone 'Asia/Seoul'
      ),
      'YYYY-MM'
    )
  );
  return new;
end;
$$;

alter function private.sync_transaction_month_blind_index()
  owner to salimon_crypto_writer;
revoke all on function private.sync_transaction_month_blind_index() from public;

drop trigger if exists encrypted_transactions_sync_month_blind_index
on public.encrypted_transactions;
create trigger encrypted_transactions_sync_month_blind_index
before insert or update of private_payload on public.encrypted_transactions
for each row execute function private.sync_transaction_month_blind_index();

create or replace function public.load_finance_month_transactions(
  target_month date
)
returns table (
  id uuid,
  ledger_id uuid,
  created_by uuid,
  updated_by uuid,
  actor_user_id uuid,
  type text,
  status text,
  amount numeric,
  currency text,
  transaction_at timestamptz,
  category_id uuid,
  payment_method_id uuid,
  merchant_name text,
  memo text,
  source_type text,
  source_app text,
  source_sender text,
  source_hash text,
  parse_confidence numeric,
  recurring_rule_id uuid,
  recurring_type text,
  installment_number int,
  installment_total int,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  tags text[],
  income_kind text
)
language plpgsql
security definer
set search_path = public, private, auth, pg_catalog
as $$
declare
  month_start date := date_trunc('month', target_month)::date;
  month_blind_index text := private.blind_index(to_char(month_start, 'YYYY-MM'));
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  perform public.materialize_finance_month(month_start);

  return query
  select
    stored_transaction.id,
    stored_transaction.ledger_id,
    stored_transaction.created_by,
    stored_transaction.updated_by,
    stored_transaction.actor_user_id,
    stored_transaction.type,
    stored_transaction.status,
    (decrypted.payload ->> 'amount')::numeric,
    stored_transaction.currency,
    (decrypted.payload ->> 'transaction_at')::timestamptz,
    stored_transaction.category_id,
    stored_transaction.payment_method_id,
    decrypted.payload ->> 'merchant_name',
    decrypted.payload ->> 'memo',
    stored_transaction.source_type,
    decrypted.payload ->> 'source_app',
    decrypted.payload ->> 'source_sender',
    stored_transaction.source_hash,
    stored_transaction.parse_confidence,
    stored_transaction.recurring_rule_id,
    stored_transaction.recurring_type,
    stored_transaction.installment_number,
    stored_transaction.installment_total,
    stored_transaction.created_at,
    stored_transaction.updated_at,
    stored_transaction.deleted_at,
    coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(decrypted.payload -> 'tags', '[]'::jsonb)
        )
      ),
      array[]::text[]
    ),
    stored_transaction.income_kind
  from public.encrypted_transactions stored_transaction
  cross join lateral (
    select private.decrypt_payload(stored_transaction.private_payload) as payload
  ) decrypted
  where stored_transaction.transaction_month_blind_index = month_blind_index
    and stored_transaction.deleted_at is null
    and public.is_ledger_member(stored_transaction.ledger_id)
  order by
    (decrypted.payload ->> 'transaction_at')::timestamptz desc,
    stored_transaction.id;
end;
$$;

revoke all on function public.load_finance_month_transactions(date) from public;
grant execute on function public.load_finance_month_transactions(date)
to authenticated;
