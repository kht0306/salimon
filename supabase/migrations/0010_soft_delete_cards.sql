alter table public.payment_methods
  add column if not exists deleted_at timestamptz;
