-- Clique Phase 3: Homie care rules + care activity on Home.
--  * Care events carry a validated payload ({"action": ...}).
--  * Friends (viewers who cannot edit) may only feed / play / clean / talk, once per 10 minutes per Homie.
--  * A friend's care shows up on Home as 'homie_cared' (at most once per friend per Homie per day) and
--    is private to the friend and the owner (target_user_id), so it never leaks the Homie to third parties.
-- Idempotent: safe to re-run.

alter table public.clique_activities drop constraint if exists clique_activities_verb_check;
alter table public.clique_activities add constraint clique_activities_verb_check check (verb in (
  'posted', 'blurbed', 'befriended', 'joined_circle', 'created_circle',
  'homie_created', 'homie_evolved', 'homie_claimed', 'homie_reel', 'homie_narrative', 'homie_cared'));

create or replace function public.clique_guard_homie_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_action text;
begin
  if public.clique_is_trusted() then return new; end if;
  if new.type = 'care' then
    v_action := new.payload ->> 'action';
    if v_action is null or v_action not in ('feed', 'play', 'clean', 'talk', 'sleep', 'wake', 'medicine') then
      raise exception 'invalid care action' using errcode = '22023';
    end if;
    if new.payload ? 'food' and (jsonb_typeof(new.payload -> 'food') <> 'string'
                                 or char_length(new.payload ->> 'food') > 40) then
      raise exception 'invalid care food' using errcode = '22023';
    end if;
    if not public.clique_can_edit_homie(new.homie_id) then
      if v_action not in ('feed', 'play', 'clean', 'talk') then
        raise exception 'friends can feed, play, clean or talk' using errcode = '42501';
      end if;
      if exists (
        select 1 from public.clique_homie_events e
        where e.homie_id = new.homie_id and e.actor_id = new.actor_id and e.type = 'care'
          and e.created_at > now() - interval '10 minutes'
      ) then
        raise exception 'care cooldown: try again in a few minutes' using errcode = 'P0001';
      end if;
    end if;
  elsif new.type = 'evolve' then
    if coalesce(new.payload ->> 'to', '') not in ('baby', 'kid', 'teen', 'adult', 'elder') then
      raise exception 'invalid evolve stage' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists clique_homie_event_guard on public.clique_homie_events;
create trigger clique_homie_event_guard before insert on public.clique_homie_events
  for each row execute function public.clique_guard_homie_event();

create or replace function public.clique_activity_from_homie_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.clique_homies%rowtype;
  v_verb text;
  v_actor uuid;
begin
  select * into h from public.clique_homies where id = new.homie_id;
  if not found then return new; end if;
  v_actor := coalesce(new.actor_id, h.owner_id);
  v_verb := case new.type
    when 'created' then 'homie_created' when 'evolve' then 'homie_evolved'
    when 'claimed' then 'homie_claimed' when 'reel' then 'homie_reel'
    when 'narrative' then 'homie_narrative'
    when 'care' then case when v_actor is distinct from h.owner_id and v_actor is distinct from h.claimed_by
                          then 'homie_cared' end
    else null end;
  if v_verb is null then return new; end if;
  if v_verb = 'homie_cared' then
    if exists (select 1 from public.clique_activities a
               where a.verb = 'homie_cared' and a.actor_id = v_actor and a.homie_id = h.id
                 and a.created_at > now() - interval '1 day') then
      return new;
    end if;
    insert into public.clique_activities (actor_id, verb, object_type, object_id, homie_id, target_user_id,
                                          visibility, summary)
    values (v_actor, v_verb, 'homie_event', new.id, h.id, h.owner_id,
            'private',  -- actor + owner only: a friend's friends must not learn about the owner's Homie
            jsonb_build_object('homie_name', h.name, 'type', new.type, 'action', new.payload ->> 'action'));
    return new;
  end if;
  insert into public.clique_activities (actor_id, verb, object_type, object_id, homie_id, visibility, summary)
  values (v_actor, v_verb, 'homie_event', new.id, h.id,
          public.clique_least_vis(h.visibility, public.clique_actor_visibility(h.owner_id)),
          jsonb_build_object('homie_name', h.name, 'type', new.type)
            || case when new.type = 'evolve' then jsonb_build_object('to', new.payload ->> 'to') else '{}'::jsonb end);
  return new;
end;
$$;

-- Internal trigger functions: not callable through the API.
revoke execute on function public.clique_guard_homie_event() from public, anon, authenticated;
revoke execute on function public.clique_activity_from_homie_event() from public, anon, authenticated;
