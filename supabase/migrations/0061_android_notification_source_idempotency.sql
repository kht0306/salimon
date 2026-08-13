create unique index if not exists transactions_creator_source_hash_uidx
on public.encrypted_transactions (created_by, source_hash)
where
  source_type = 'android_sms_notification'
  and source_hash is not null
  and deleted_at is null;
