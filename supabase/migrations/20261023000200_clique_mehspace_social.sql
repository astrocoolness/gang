-- Clique Phase 4: Mehspace social rules.
--  * Top 8 may only name real friends (or the Homie's people / the Circle's members), no duplicates.
--  * layout_json media paths (song/photo) must live in the editor's own clique-media/{uid}/mehspace/ folder;
--    layout_json.render_error is written only by the trusted sanitizer.
--  * A user's Mehspace can never be more visible than their profile privacy, and tightening the profile
--    tightens the Mehspace.
--  * Blurbs are friend-made: written by friends of the page's person (or Circle members), never by its editors.
--  * Post media paths must be the author's own clique-media/{uid}/posts/ files.
--  * Activity: posts/blurbs on a Homie's Mehspace target the Homie's owner; mood changes reach Home
--    (one per person per 6 hours).
-- Idempotent: safe to re-run.

alter table public.clique_activities drop constraint if exists clique_activities_verb_check;
alter table public.clique_activities add constraint clique_activities_verb_check check (verb in (
  'posted', 'blurbed', 'befriended', 'joined_circle', 'created_circle',
  'homie_created', 'homie_evolved', 'homie_claimed', 'homie_reel', 'homie_narrative', 'homie_cared',
  'mood_changed'));
alter table public.clique_activities drop constraint if exists clique_activities_object_type_check;
alter table public.clique_activities add constraint clique_activities_object_type_check check (object_type in (
  'post', 'blurb', 'friendship', 'circle', 'homie', 'homie_event', 'mehspace'));

-- May the current editor feature p_friend in this space's Top 8? Only answers about spaces the caller
-- edits, and only reveals the caller's own friendships (no friendship oracle for other people).
create or replace function public.clique_top_friend_allowed(p_owner_type text, p_user uuid, p_homie uuid, p_circle uuid, p_friend uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and case p_owner_type
    when 'user' then p_user = auth.uid() and p_friend <> p_user and public.clique_are_friends(p_user, p_friend)
    when 'homie' then public.clique_can_edit_homie(p_homie) and (
      public.clique_are_friends(auth.uid(), p_friend)
      or exists (select 1 from public.clique_homies h where h.id = p_homie and p_friend in (h.owner_id, h.claimed_by)))
    when 'circle' then public.clique_circle_role(p_circle) in ('owner', 'admin') and exists (
      select 1 from public.clique_circle_members m where m.circle_id = p_circle and m.user_id = p_friend)
    else false end
$$;

create or replace function public.clique_guard_mehspace_social()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  f uuid;
  k text;
  v_privacy text;
  v_path text;
begin
  if public.clique_is_trusted() then return new; end if;

  -- Top 8
  if array_position(new.top_friends, null) is not null
     or cardinality(new.top_friends) <> (select count(distinct x) from unnest(new.top_friends) x) then
    raise exception 'top friends must be distinct' using errcode = '22023';
  end if;
  foreach f in array new.top_friends loop
    if tg_op = 'UPDATE' and f = any(old.top_friends) then continue; end if;  -- keep existing picks
    if not public.clique_top_friend_allowed(new.owner_type, new.user_id, new.homie_id, new.circle_id, f) then
      raise exception 'top friends must be your friends' using errcode = '42501';
    end if;
  end loop;

  -- layout_json
  if jsonb_typeof(new.layout_json) <> 'object' or pg_column_size(new.layout_json) > 20000 then
    raise exception 'invalid layout' using errcode = '22023';
  end if;
  foreach k in array array['song_path', 'photo_path'] loop
    v_path := new.layout_json ->> k;
    if v_path is null then continue; end if;
    if tg_op = 'UPDATE' and v_path is not distinct from old.layout_json ->> k then continue; end if;
    if v_path !~ ('^' || auth.uid()::text || '/mehspace/[A-Za-z0-9._-]{1,120}$') then
      raise exception 'media must be your own clique-media/{uid}/mehspace file' using errcode = '42501';
    end if;
  end loop;
  -- render_error belongs to the trusted sanitizer: keep its value, or clear it when the raw source changes.
  new.layout_json := new.layout_json - 'render_error';
  if tg_op = 'UPDATE' and old.layout_json ? 'render_error'
     and new.custom_html is not distinct from old.custom_html and new.custom_css is not distinct from old.custom_css then
    new.layout_json := new.layout_json || jsonb_build_object('render_error', old.layout_json -> 'render_error');
  end if;

  -- Visibility never broader than the person's profile privacy.
  if new.owner_type = 'user' then
    select privacy into v_privacy from public.clique_profiles where id = new.user_id;
    if v_privacy is not null and (v_privacy = 'private' and new.visibility <> 'private'
                                  or v_privacy = 'friends' and new.visibility = 'public') then
      raise exception 'Mehspace visibility cannot be broader than your profile privacy (%)', v_privacy using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists clique_mehspace_social_guard on public.clique_mehspaces;
create trigger clique_mehspace_social_guard before insert or update on public.clique_mehspaces
  for each row execute function public.clique_guard_mehspace_social();

-- Tightening profile privacy tightens the user's Mehspace.
create or replace function public.clique_profile_privacy_to_space()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.privacy is distinct from old.privacy then
    update public.clique_mehspaces set visibility = public.clique_least_vis(visibility, new.privacy)
    where user_id = new.id and visibility <> public.clique_least_vis(visibility, new.privacy);
  end if;
  return new;
end;
$$;
drop trigger if exists clique_profile_privacy_space on public.clique_profiles;
create trigger clique_profile_privacy_space after update of privacy on public.clique_profiles
  for each row execute function public.clique_profile_privacy_to_space();

-- Friend-made blurbs.
create or replace function public.clique_can_blurb(p_space uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and public.clique_can_see_space(p_space) and not public.clique_can_edit_space(p_space)
    and exists (
      select 1 from public.clique_mehspaces s
      left join public.clique_homies h on h.id = s.homie_id
      where s.id = p_space and case s.owner_type
        when 'user' then public.clique_are_friends(s.user_id, auth.uid())
        when 'homie' then public.clique_are_friends(h.owner_id, auth.uid())
          or (h.claimed_by is not null and public.clique_are_friends(h.claimed_by, auth.uid()))
        when 'circle' then public.clique_is_circle_member(s.circle_id)
        else false end)
$$;
drop policy if exists clique_blurbs_insert on public.clique_blurbs;
create policy clique_blurbs_insert on public.clique_blurbs
  for insert to authenticated with check (author_id = auth.uid() and public.clique_can_blurb(space_id));

-- Post media: [{path, mime, alt?}] in the author's own posts folder, images only, at most 4.
create or replace function public.clique_guard_post()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  m jsonb;
begin
  if public.clique_is_trusted() then return new; end if;
  if jsonb_typeof(new.media) <> 'array' or jsonb_array_length(new.media) > 4 then
    raise exception 'invalid post media' using errcode = '22023';
  end if;
  for m in select * from jsonb_array_elements(new.media) loop
    if jsonb_typeof(m) <> 'object'
       or coalesce(m ->> 'path', '') !~ ('^' || new.author_id::text || '/posts/[A-Za-z0-9._-]{1,120}$')
       or coalesce(m ->> 'mime', '') not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
       or char_length(coalesce(m ->> 'alt', '')) > 300 then
      raise exception 'invalid post media' using errcode = '22023';
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists clique_post_guard on public.clique_posts;
create trigger clique_post_guard before insert or update on public.clique_posts
  for each row execute function public.clique_guard_post();

-- Posts/blurbs -> Home. Same as Phase 2, plus: Homie spaces target the Homie's owner and name the Homie.
create or replace function public.clique_activity_from_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.clique_mehspaces%rowtype;
  h public.clique_homies%rowtype;
  v_vis text;
  v_target uuid;
begin
  select * into s from public.clique_mehspaces where id = new.space_id;
  if s.owner_type = 'homie' then select * into h from public.clique_homies where id = s.homie_id; end if;
  if s.owner_type = 'circle' then
    v_vis := case when s.visibility = 'public' then 'public' else 'circle' end;
  elsif s.visibility = 'private' then
    v_vis := 'private';
  else
    v_vis := public.clique_least_vis(s.visibility, public.clique_actor_visibility(new.author_id));
  end if;
  v_target := case s.owner_type when 'user' then s.user_id when 'homie' then h.owner_id end;
  if v_target = new.author_id then v_target := null; end if;
  insert into public.clique_activities (actor_id, verb, object_type, object_id, circle_id, homie_id,
                                        target_user_id, visibility, summary)
  values (new.author_id, case when tg_table_name = 'clique_blurbs' then 'blurbed' else 'posted' end,
          case when tg_table_name = 'clique_blurbs' then 'blurb' else 'post' end,
          new.id, s.circle_id, s.homie_id, v_target, v_vis,
          jsonb_build_object('space_id', new.space_id, 'excerpt', left(new.body, 140), 'owner_type', s.owner_type)
            || case when h.id is not null then jsonb_build_object('homie_name', h.name) else '{}'::jsonb end);
  return new;
end;
$$;

-- Mood -> Home (user Mehspaces only, one per person per 6 hours: newer replaces older).
create or replace function public.clique_activity_from_mood()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_type <> 'user' or new.mood = '' or new.mood is not distinct from old.mood then return new; end if;
  delete from public.clique_activities
  where actor_id = new.user_id and verb = 'mood_changed' and created_at > now() - interval '6 hours';
  insert into public.clique_activities (actor_id, verb, object_type, object_id, visibility, summary)
  values (new.user_id, 'mood_changed', 'mehspace', new.id,
          public.clique_least_vis(new.visibility, public.clique_actor_visibility(new.user_id)),
          jsonb_build_object('space_id', new.id, 'mood', new.mood));
  return new;
end;
$$;
drop trigger if exists clique_mood_activity on public.clique_mehspaces;
create trigger clique_mood_activity after update of mood on public.clique_mehspaces
  for each row execute function public.clique_activity_from_mood();

revoke execute on function public.clique_top_friend_allowed(text, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.clique_top_friend_allowed(text, uuid, uuid, uuid, uuid) to authenticated;
revoke execute on function public.clique_guard_mehspace_social() from public, anon, authenticated;
revoke execute on function public.clique_profile_privacy_to_space() from public, anon, authenticated;
revoke execute on function public.clique_guard_post() from public, anon, authenticated;
revoke execute on function public.clique_activity_from_mood() from public, anon, authenticated;
revoke execute on function public.clique_can_blurb(uuid) from public, anon;
grant execute on function public.clique_can_blurb(uuid) to authenticated;

-- Fix (Phase 2 bug): INSERT ... RETURNING of a Homie/Circle Mehspace failed RLS, because the select policy
-- only reached those rows through clique_can_see_space(id), which can't see the row being inserted.
-- Editors now match directly on the row's own columns. (Device import's upsert ... select('id') needs this.)
drop policy if exists clique_mehspaces_select on public.clique_mehspaces;
create policy clique_mehspaces_select on public.clique_mehspaces
  for select to authenticated using (
    (owner_type = 'user' and user_id = auth.uid())
    or (owner_type = 'homie' and public.clique_can_edit_homie(homie_id))
    or (owner_type = 'circle' and public.clique_circle_role(circle_id) in ('owner', 'admin'))
    or public.clique_can_see_space(id));
