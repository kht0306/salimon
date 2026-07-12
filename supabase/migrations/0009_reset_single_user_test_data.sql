-- One-time test reset requested during development. Only runs when this project
-- has exactly one profile, so another member can never be selected implicitly.
do $$
declare
  target_user_id uuid;
  profile_count int;
begin
  select count(*) into profile_count from public.profiles;

  if profile_count = 1 then
    select id into target_user_id from public.profiles limit 1;
    delete from public.card_message_samples where submitted_by = target_user_id;
    delete from public.notification_rules where user_id = target_user_id;
    delete from public.ledgers where owner_id = target_user_id;
    raise notice 'Single-user test finance data was reset.';
  else
    raise notice 'Test reset skipped because the project has % profiles.', profile_count;
  end if;
end;
$$;
