-- The development-only reset action was reachable from the production
-- management screen and could delete real transaction history. The UI and
-- client call are removed in the same release; retire the RPC as well.
drop function if exists public.reset_my_finance_data();
