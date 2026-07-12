alter table public.payment_methods
  add column if not exists is_primary boolean not null default false;

with ranked as (
  select id, row_number() over (
    partition by ledger_id, owner_user_id
    order by created_at, id
  ) as card_number
  from public.payment_methods
  where type = 'card' and is_active and deleted_at is null
)
update public.payment_methods method
set is_primary = true
from ranked
where method.id = ranked.id and ranked.card_number = 1;

create unique index if not exists payment_methods_active_primary_uidx
on public.payment_methods (ledger_id, owner_user_id)
where is_primary and is_active and deleted_at is null;
