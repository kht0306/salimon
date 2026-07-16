create view public.user_payment_methods
with (security_invoker = true)
as
select
  method.id,
  method.owner_user_id,
  data.payload ->> 'name' as name,
  method.type,
  data.payload ->> 'last4' as last4,
  data.payload ->> 'issuer' as issuer,
  method.is_active,
  method.deleted_at,
  method.is_debit,
  (data.payload ->> 'payment_day')::int as payment_day,
  (data.payload ->> 'billing_period_end_day')::int as billing_period_end_day,
  (data.payload ->> 'billing_period_end_month_offset')::int
    as billing_period_end_month_offset,
  method.created_at,
  method.updated_at
from public.encrypted_user_payment_methods method
cross join lateral (
  select private.decrypt_payload(method.private_payload) as payload
) data
where method.owner_user_id = auth.uid();

grant select on public.user_payment_methods to authenticated;
