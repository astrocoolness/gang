-- Clique Phase 2 / 6 of 7: activity feed for Home. Written only by triggers (SECURITY DEFINER).

create table if not exists public.clique_activities (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  verb text not null check (verb in (
    'posted', 'blurbed', 'befriended', 'joined_circle', 'created_circle',
    'homie_created', 'homie_evolved', 'homie_claimed', 'homie_reel', 'homie_narrative')),
  object_type text not null check (object_type in ('post', 'blurb', 'friendship', 'circle', 'homie', 'homie_event')),
  object_id uuid not null,
  circle_id uuid references public.clique_circles(id) on delete cascade,
  homie_id uuid references public.clique_homies(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete cascade,
  visibility text not null default 'friends' check (visibility in ('public', 'friends', 'circle', 'private')),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint clique_activities_circle_vis check (visibility <> 'circle' or circle_id is not null)
);
create index if not exists clique_activities_actor on public.clique_activities (actor_id, created_at desc);
create index if not exists clique_activities_circle on public.clique_activities (circle_id, created_at desc);
create index if not exists clique_activities_created on public.clique_activities (created_at desc);

alter table public.clique_activities enable row level security;
drop policy if exists clique_activities_select on public.clique_activities;
create policy clique_activities_select on public.clique_activities
  for select to authenticated using (
    actor_id = auth.uid()
    or target_user_id = auth.uid()
    or (not public.clique_is_blocked(actor_id, auth.uid()) and (
      (visibility = 'public')
      or (visibility = 'friends' and public.clique_are_friends(actor_id, auth.uid()))
      or (visibility = 'circle' and public.clique_is_circle_member(circle_id))
    ))
  );
drop policy if exists clique_activities_delete_own on public.clique_activities;
create policy clique_activities_delete_own on public.clique_activities
  for delete to authenticated using (actor_id = auth.uid());
-- No insert/update policies: rows come from triggers below.

-- Map a profile's privacy to a default activity visibility.
create or replace function public.clique_actor_visibility(p_actor uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case coalesce((select privacy from public.clique_profiles where id = p_actor), 'friends')
    when 'public' then 'public' when 'private' then 'private' else 'friends' end
$$;

create or replace function public.clique_activity_from_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.clique_mehspaces%rowtype;
  v_vis text;
begin
  select * into s from public.clique_mehspaces where id = new.space_id;
  if s.owner_type = 'circle' then
    v_vis := case when s.visibility = 'public' then 'public' else 'circle' end;
  elsif s.visibility = 'private' then
    v_vis := 'private';
  else
    v_vis := clique_least_vis(s.visibility, public.clique_actor_visibility(new.author_id));
  end if;
  insert into public.clique_activities (actor_id, verb, object_type, object_id, circle_id, homie_id,
                                        target_user_id, visibility, summary)
  values (new.author_id, case when tg_table_name = 'clique_blurbs' then 'blurbed' else 'posted' end,
          case when tg_table_name = 'clique_blurbs' then 'blurb' else 'post' end,
          new.id, s.circle_id, s.homie_id,
          case when s.user_id is distinct from new.author_id then s.user_id end,
          v_vis, jsonb_build_object('space_id', new.space_id, 'excerpt', left(new.body, 140)));
  return new;
end;
$$;

-- Most restrictive of two visibilities (public > friends > private).
create or replace function public.clique_least_vis(a text, b text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when 'private' in (a, b) then 'private'
    when 'friends' in (a, b) then 'friends'
    else 'public' end
$$;

drop trigger if exists clique_post_activity on public.clique_posts;
create trigger clique_post_activity after insert on public.clique_posts
  for each row execute function public.clique_activity_from_post();
drop trigger if exists clique_blurb_activity on public.clique_blurbs;
create trigger clique_blurb_activity after insert on public.clique_blurbs
  for each row execute function public.clique_activity_from_post();

create or replace function public.clique_activity_from_homie_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.clique_homies%rowtype;
  v_verb text;
begin
  v_verb := case new.type
    when 'created' then 'homie_created' when 'evolve' then 'homie_evolved'
    when 'claimed' then 'homie_claimed' when 'reel' then 'homie_reel'
    when 'narrative' then 'homie_narrative' else null end;
  if v_verb is null then return new; end if;
  select * into h from public.clique_homies where id = new.homie_id;
  insert into public.clique_activities (actor_id, verb, object_type, object_id, homie_id, visibility, summary)
  values (coalesce(new.actor_id, h.owner_id), v_verb, 'homie_event', new.id, h.id,
          public.clique_least_vis(h.visibility, public.clique_actor_visibility(h.owner_id)),
          jsonb_build_object('homie_name', h.name, 'type', new.type));
  return new;
end;
$$;
drop trigger if exists clique_homie_event_activity on public.clique_homie_events;
create trigger clique_homie_event_activity after insert on public.clique_homie_events
  for each row execute function public.clique_activity_from_homie_event();

create or replace function public.clique_activity_from_friendship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and (tg_op = 'INSERT' or old.status is distinct from 'accepted') then
    insert into public.clique_activities (actor_id, verb, object_type, object_id, target_user_id, visibility)
    values (new.addressee_id, 'befriended', 'friendship', new.id, new.requester_id,
            public.clique_least_vis(public.clique_actor_visibility(new.addressee_id),
                             public.clique_actor_visibility(new.requester_id)));
  end if;
  return new;
end;
$$;
drop trigger if exists clique_friendship_activity on public.clique_friendships;
create trigger clique_friendship_activity after insert or update on public.clique_friendships
  for each row execute function public.clique_activity_from_friendship();

create or replace function public.clique_activity_from_circle_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.clique_activities (actor_id, verb, object_type, object_id, circle_id, visibility)
  values (new.user_id, case when new.role = 'owner' then 'created_circle' else 'joined_circle' end,
          'circle', new.circle_id, new.circle_id, 'circle');
  return new;
end;
$$;
drop trigger if exists clique_circle_member_activity on public.clique_circle_members;
create trigger clique_circle_member_activity after insert on public.clique_circle_members
  for each row execute function public.clique_activity_from_circle_member();

revoke execute on function public.clique_actor_visibility(uuid) from public;

-- New homies emit a 'created' event (which feeds the activity above).
create or replace function public.clique_homie_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.clique_homie_events (homie_id, actor_id, type, payload)
  values (new.id, new.owner_id, case when new.legacy_id is not null then 'imported' else 'created' end,
          jsonb_build_object('kind', new.kind));
  return new;
end;
$$;
drop trigger if exists clique_homie_created_event on public.clique_homies;
create trigger clique_homie_created_event after insert on public.clique_homies
  for each row execute function public.clique_homie_after_insert();

revoke execute on function public.clique_least_vis(text, text) from public;
