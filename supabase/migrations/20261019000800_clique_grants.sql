-- Clique Phase 2: function grants. Supabase grants EXECUTE on new public functions to anon and
-- authenticated via default privileges, so REVOKE ... FROM PUBLIC alone is not enough.
-- SECURITY DEFINER clique_* functions: authenticated + service_role only.
-- Internal trigger/helper functions: no direct client access.
do $$
declare
  f record;
  internal text[] := array[
    'clique_actor_visibility', 'clique_least_vis', 'clique_circle_after_insert',
    'clique_profile_after_insert', 'clique_message_after_insert', 'clique_circle_thread_after_insert',
    'clique_activity_from_post', 'clique_activity_from_homie_event', 'clique_activity_from_friendship',
    'clique_activity_from_circle_member', 'clique_homie_after_insert'];
begin
  for f in
    select p.oid::regprocedure as sig, p.proname, p.prosecdef
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'clique\_%'
  loop
    if f.proname = any(internal) then
      execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    elsif f.prosecdef then
      execute format('revoke execute on function %s from public, anon', f.sig);
      execute format('grant execute on function %s to authenticated, service_role', f.sig);
    end if;
  end loop;
end;
$$;
