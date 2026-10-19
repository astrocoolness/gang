-- Clique Phase 2 / 4 of 7: Mehspace pages (user | homie | circle), posts, blurbs, likes.
--
-- Custom HTML/CSS: users write custom_html / custom_css (stored raw, never rendered directly).
-- A trusted server step (service role) sanitizes them into rendered_html / rendered_css and sets
-- render_status = 'ok'. Clients can never write rendered_* — any change to the raw fields resets
-- them to NULL / 'pending'. Rendering happens in a sandboxed iframe; see docs/mehspace-rendering.md.

create table if not exists public.clique_mehspaces (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('user', 'homie', 'circle')),
  user_id uuid unique references auth.users(id) on delete cascade,
  homie_id uuid unique references public.clique_homies(id) on delete cascade,
  circle_id uuid unique references public.clique_circles(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 80),
  theme text not null default 'night',
  layout_json jsonb not null default '{}'::jsonb,
  song_url text check (song_url is null or song_url ~ '^https://'),
  mood text not null default '' check (char_length(mood) <= 60),
  about text not null default '' check (char_length(about) <= 5000),
  interests text[] not null default '{}',
  heroes text[] not null default '{}',
  top_friends uuid[] not null default '{}' check (cardinality(top_friends) <= 8),
  custom_html text not null default '' check (char_length(custom_html) <= 100000),
  custom_css text not null default '' check (char_length(custom_css) <= 50000),
  rendered_html text,
  rendered_css text,
  render_status text not null default 'pending' check (render_status in ('pending', 'ok', 'rejected')),
  sanitizer_version text,
  sanitized_at timestamptz,
  visibility text not null default 'friends' check (visibility in ('public', 'friends', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clique_mehspaces_one_owner check (
    num_nonnulls(user_id, homie_id, circle_id) = 1
    and ((owner_type = 'user' and user_id is not null)
      or (owner_type = 'homie' and homie_id is not null)
      or (owner_type = 'circle' and circle_id is not null))
  )
);

drop trigger if exists clique_mehspaces_updated_at on public.clique_mehspaces;
create trigger clique_mehspaces_updated_at before update on public.clique_mehspaces
  for each row execute function public.clique_set_updated_at();

create or replace function public.clique_guard_mehspace()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.clique_is_trusted() then return new; end if;
  if tg_op = 'UPDATE' then
    if new.owner_type <> old.owner_type or new.user_id is distinct from old.user_id
       or new.homie_id is distinct from old.homie_id or new.circle_id is distinct from old.circle_id then
      raise exception 'mehspace owner is immutable';
    end if;
    if new.custom_html is distinct from old.custom_html or new.custom_css is distinct from old.custom_css then
      new.rendered_html := null; new.rendered_css := null;
      new.render_status := 'pending'; new.sanitizer_version := null; new.sanitized_at := null;
    else
      new.rendered_html := old.rendered_html; new.rendered_css := old.rendered_css;
      new.render_status := old.render_status; new.sanitizer_version := old.sanitizer_version;
      new.sanitized_at := old.sanitized_at;
    end if;
  else
    new.rendered_html := null; new.rendered_css := null;
    new.render_status := 'pending'; new.sanitizer_version := null; new.sanitized_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists clique_mehspace_guard on public.clique_mehspaces;
create trigger clique_mehspace_guard before insert or update on public.clique_mehspaces
  for each row execute function public.clique_guard_mehspace();

create or replace function public.clique_can_see_space(p_space uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clique_mehspaces s
    where s.id = p_space and auth.uid() is not null and (
      case s.owner_type
        when 'user' then s.user_id = auth.uid() or (
          not public.clique_is_blocked(s.user_id, auth.uid()) and (
            s.visibility = 'public'
            or (s.visibility = 'friends' and public.clique_are_friends(s.user_id, auth.uid()))))
        when 'homie' then public.clique_can_edit_homie(s.homie_id)
          or (s.visibility <> 'private' and public.clique_can_see_homie(s.homie_id))
        when 'circle' then public.clique_is_circle_member(s.circle_id)
          or (s.visibility = 'public' and public.clique_circle_is_public(s.circle_id))
      end
    )
  )
$$;

create or replace function public.clique_can_edit_space(p_space uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clique_mehspaces s
    where s.id = p_space and auth.uid() is not null and (
      (s.owner_type = 'user' and s.user_id = auth.uid())
      or (s.owner_type = 'homie' and public.clique_can_edit_homie(s.homie_id))
      or (s.owner_type = 'circle' and public.clique_circle_role(s.circle_id) in ('owner', 'admin'))
    )
  )
$$;

alter table public.clique_mehspaces enable row level security;
drop policy if exists clique_mehspaces_select on public.clique_mehspaces;
create policy clique_mehspaces_select on public.clique_mehspaces
  for select to authenticated
  using ((owner_type = 'user' and user_id = auth.uid()) or public.clique_can_see_space(id));
drop policy if exists clique_mehspaces_insert on public.clique_mehspaces;
create policy clique_mehspaces_insert on public.clique_mehspaces
  for insert to authenticated with check (
    (owner_type = 'user' and user_id = auth.uid())
    or (owner_type = 'homie' and public.clique_can_edit_homie(homie_id))
    or (owner_type = 'circle' and public.clique_circle_role(circle_id) in ('owner', 'admin'))
  );
drop policy if exists clique_mehspaces_update on public.clique_mehspaces;
create policy clique_mehspaces_update on public.clique_mehspaces
  for update to authenticated
  using (public.clique_can_edit_space(id)) with check (public.clique_can_edit_space(id));
drop policy if exists clique_mehspaces_delete on public.clique_mehspaces;
create policy clique_mehspaces_delete on public.clique_mehspaces
  for delete to authenticated using (public.clique_can_edit_space(id) and owner_type <> 'user');

-- Every profile gets its own Mehspace (visibility follows profile privacy at creation).
create or replace function public.clique_profile_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.clique_mehspaces (owner_type, user_id, title, visibility)
  values ('user', new.id, new.display_name, new.privacy)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists clique_profile_mehspace on public.clique_profiles;
create trigger clique_profile_mehspace after insert on public.clique_profiles
  for each row execute function public.clique_profile_after_insert();

-- ---------------------------------------------------------------------------
-- Posts, blurbs, likes
-- ---------------------------------------------------------------------------
create table if not exists public.clique_posts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.clique_mehspaces(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  as_homie_id uuid references public.clique_homies(id) on delete set null,
  body text not null default '' check (char_length(body) <= 5000),
  media jsonb not null default '[]'::jsonb,  -- [{path, mime, width, height, alt}] in clique-media
  legacy_source text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clique_posts_not_empty check (char_length(body) > 0 or jsonb_array_length(media) > 0)
);
create index if not exists clique_posts_space on public.clique_posts (space_id, created_at desc);
create unique index if not exists clique_posts_legacy_unique
  on public.clique_posts (author_id, legacy_source, legacy_id);  -- NULLs distinct: only imported rows collide
drop trigger if exists clique_posts_updated_at on public.clique_posts;
create trigger clique_posts_updated_at before update on public.clique_posts
  for each row execute function public.clique_set_updated_at();

alter table public.clique_posts enable row level security;
drop policy if exists clique_posts_select on public.clique_posts;
create policy clique_posts_select on public.clique_posts
  for select to authenticated using (public.clique_can_see_space(space_id));
drop policy if exists clique_posts_insert on public.clique_posts;
create policy clique_posts_insert on public.clique_posts
  for insert to authenticated with check (
    author_id = auth.uid() and public.clique_can_see_space(space_id)
    and (as_homie_id is null or public.clique_can_edit_homie(as_homie_id))
  );
drop policy if exists clique_posts_update on public.clique_posts;
create policy clique_posts_update on public.clique_posts
  for update to authenticated using (author_id = auth.uid())
  with check (author_id = auth.uid() and (as_homie_id is null or public.clique_can_edit_homie(as_homie_id)));
drop policy if exists clique_posts_delete on public.clique_posts;
create policy clique_posts_delete on public.clique_posts
  for delete to authenticated using (author_id = auth.uid() or public.clique_can_edit_space(space_id));

create table if not exists public.clique_blurbs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.clique_mehspaces(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists clique_blurbs_space on public.clique_blurbs (space_id, created_at desc);
alter table public.clique_blurbs enable row level security;
drop policy if exists clique_blurbs_select on public.clique_blurbs;
create policy clique_blurbs_select on public.clique_blurbs
  for select to authenticated using (public.clique_can_see_space(space_id));
drop policy if exists clique_blurbs_insert on public.clique_blurbs;
create policy clique_blurbs_insert on public.clique_blurbs
  for insert to authenticated with check (author_id = auth.uid() and public.clique_can_see_space(space_id));
drop policy if exists clique_blurbs_delete on public.clique_blurbs;
create policy clique_blurbs_delete on public.clique_blurbs
  for delete to authenticated using (author_id = auth.uid() or public.clique_can_edit_space(space_id));

create table if not exists public.clique_post_likes (
  post_id uuid not null references public.clique_posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.clique_post_likes enable row level security;
drop policy if exists clique_post_likes_select on public.clique_post_likes;
create policy clique_post_likes_select on public.clique_post_likes
  for select to authenticated using (
    exists (select 1 from public.clique_posts p where p.id = post_id)  -- inherits post RLS
  );
drop policy if exists clique_post_likes_insert on public.clique_post_likes;
create policy clique_post_likes_insert on public.clique_post_likes
  for insert to authenticated with check (
    user_id = auth.uid() and exists (select 1 from public.clique_posts p where p.id = post_id)
  );
drop policy if exists clique_post_likes_delete on public.clique_post_likes;
create policy clique_post_likes_delete on public.clique_post_likes
  for delete to authenticated using (user_id = auth.uid());

revoke execute on function public.clique_can_see_space(uuid) from public;
revoke execute on function public.clique_can_edit_space(uuid) from public;
grant execute on function public.clique_can_see_space(uuid) to authenticated;
grant execute on function public.clique_can_edit_space(uuid) to authenticated;
