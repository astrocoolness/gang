-- Clique Phase 2 / 1 of 7: identity — profiles, friendships, invites, shared helpers.
--
-- Target: rva.guru's Supabase project (shared login with rva.guru). Additive only.
-- * Does NOT alter rva.guru's existing public.profiles (billing/admin columns, owner-only RLS).
--   Clique identity lives in public.clique_profiles, keyed 1:1 to auth.users.id.
-- * public.clique_friendships is column-compatible with rva-guru-full-stack-platform PR #28
--   (feature/clique-mvp). This file supersedes that PR's friendship migration; apply only one.
-- Review and apply through the normal migration workflow; never run ad hoc against production.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- True for trusted contexts: migrations, service_role, and SECURITY DEFINER functions
-- (their statements run as the function owner). Plain API users run as anon/authenticated.
-- Deliberately SECURITY INVOKER so it reflects the caller.
create or replace function public.clique_is_trusted()
returns boolean
language sql
stable
set search_path = public
as $$ select current_user not in ('anon', 'authenticated') $$;

create or replace function public.clique_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Safe text -> uuid cast (NULL on bad input), used by Storage path policies.
create or replace function public.clique_try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- Random URL-safe secret for invites and claim codes (core gen_random_uuid, no pgcrypto needed).
create or replace function public.clique_random_code(p_len int default 10)
returns text
language sql
volatile
set search_path = public
as $$
  select upper(substr(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, greatest(6, least(p_len, 64))))
$$;

create or replace function public.clique_hash_code(p_code text)
returns text
language sql
immutable
set search_path = public
as $$ select encode(sha256(convert_to(upper(trim(p_code)), 'UTF8')), 'hex') $$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.clique_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null,
  bio text not null default '',
  status text not null default '',
  avatar_homie_id uuid,               -- FK added in the homies migration
  avatar_path text,                   -- clique-media/{user_id}/...
  privacy text not null default 'friends',
  onboarded_at timestamptz,
  legacy_source text,                 -- e.g. 'homies2', 'homies3'
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clique_profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$'),
  constraint clique_profiles_display_name_len check (char_length(display_name) between 1 and 60),
  constraint clique_profiles_bio_len check (char_length(bio) <= 500),
  constraint clique_profiles_status_len check (char_length(status) <= 80),
  constraint clique_profiles_privacy check (privacy in ('public', 'friends', 'private'))
);
create unique index if not exists clique_profiles_username_unique on public.clique_profiles (username);
create unique index if not exists clique_profiles_legacy_unique
  on public.clique_profiles (legacy_source, legacy_id);  -- NULLs distinct: only imported rows collide

drop trigger if exists clique_profiles_updated_at on public.clique_profiles;
create trigger clique_profiles_updated_at before update on public.clique_profiles
  for each row execute function public.clique_set_updated_at();

-- ---------------------------------------------------------------------------
-- Friendships (column-compatible with rva-guru PR #28)
-- ---------------------------------------------------------------------------
create table if not exists public.clique_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'blocked')),
  blocked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clique_friendships_no_self check (requester_id <> addressee_id),
  constraint clique_friendships_block_consistent check (
    (status = 'blocked' and blocked_by is not null and blocked_by in (requester_id, addressee_id))
    or (status <> 'blocked' and blocked_by is null)
  )
);
create unique index if not exists clique_friendships_pair_unique
  on public.clique_friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists clique_friendships_requester_status on public.clique_friendships (requester_id, status);
create index if not exists clique_friendships_addressee_status on public.clique_friendships (addressee_id, status);

create or replace function public.guard_clique_friendship_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  -- Trusted callers (invite claim RPC, importer, maintenance) skip end-user transition rules.
  if public.clique_is_trusted() then
    if tg_op = 'DELETE' then return old; end if;
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    if actor is null or actor <> new.requester_id
       or new.status <> 'pending' or new.blocked_by is not null then
      raise exception 'invalid friend request';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'blocked' and old.blocked_by <> actor then
      raise exception 'only the blocker may remove a block';
    end if;
    if old.status = 'pending' and old.requester_id <> actor then
      raise exception 'only the requester may withdraw a pending request';
    end if;
    return old;
  end if;

  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id
     or new.created_at <> old.created_at then
    raise exception 'friendship participants are immutable';
  end if;

  if new.status = old.status then
    if new.blocked_by is distinct from old.blocked_by then
      raise exception 'block owner is immutable without a state transition';
    end if;
  elsif new.status = 'blocked' then
    if actor is null or (actor <> old.requester_id and actor <> old.addressee_id)
       or new.blocked_by <> actor then
      raise exception 'only a participant may block and must be recorded as blocker';
    end if;
  elsif old.status = 'pending' and new.status in ('accepted', 'declined') then
    if actor is distinct from old.addressee_id or new.blocked_by is not null then
      raise exception 'only the recipient may accept or decline';
    end if;
  elsif old.status = 'declined' and new.status = 'pending' then
    if actor is distinct from old.requester_id or new.blocked_by is not null then
      raise exception 'only the original requester may retry a declined request';
    end if;
  else
    raise exception 'invalid friendship state transition';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists clique_friendship_guard on public.clique_friendships;
create trigger clique_friendship_guard
  before insert or update or delete on public.clique_friendships
  for each row execute function public.guard_clique_friendship_change();

-- SECURITY DEFINER helpers so policies can consult other RLS tables without recursion.
create or replace function public.clique_are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select a is not null and b is not null and exists (
    select 1 from public.clique_friendships f
    where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least(a, b)
      and greatest(f.requester_id, f.addressee_id) = greatest(a, b)
  )
$$;

create or replace function public.clique_is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clique_friendships f
    where f.status = 'blocked'
      and least(f.requester_id, f.addressee_id) = least(a, b)
      and greatest(f.requester_id, f.addressee_id) = greatest(a, b)
  )
$$;

-- Can the current user see this user's Clique profile/content?
create or replace function public.clique_can_see_user(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    target = auth.uid()
    or exists (
      select 1 from public.clique_profiles p
      where p.id = target
        and not public.clique_is_blocked(target, auth.uid())
        and (p.privacy = 'public'
             or (p.privacy = 'friends' and public.clique_are_friends(target, auth.uid())))
    )
  )
$$;

alter table public.clique_profiles enable row level security;
alter table public.clique_friendships enable row level security;

drop policy if exists clique_profiles_select on public.clique_profiles;
create policy clique_profiles_select on public.clique_profiles
  for select to authenticated using (public.clique_can_see_user(id));
drop policy if exists clique_profiles_insert_own on public.clique_profiles;
create policy clique_profiles_insert_own on public.clique_profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists clique_profiles_update_own on public.clique_profiles;
create policy clique_profiles_update_own on public.clique_profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- No delete policy: profiles go away with the auth user (on delete cascade).

drop policy if exists clique_friendships_select on public.clique_friendships;
create policy clique_friendships_select on public.clique_friendships
  for select to authenticated using (auth.uid() in (requester_id, addressee_id));
drop policy if exists clique_friendships_insert on public.clique_friendships;
create policy clique_friendships_insert on public.clique_friendships
  for insert to authenticated with check (
    auth.uid() = requester_id and status = 'pending' and blocked_by is null
  );
drop policy if exists clique_friendships_update on public.clique_friendships;
create policy clique_friendships_update on public.clique_friendships
  for update to authenticated
  using (auth.uid() in (requester_id, addressee_id))
  with check (auth.uid() in (requester_id, addressee_id));
drop policy if exists clique_friendships_delete on public.clique_friendships;
create policy clique_friendships_delete on public.clique_friendships
  for delete to authenticated using (auth.uid() in (requester_id, addressee_id));

-- Minimal, privacy-preserving lookup by exact username (for sending friend requests).
-- Returns a row even for friends-only profiles, but never bio/status; private profiles are hidden.
create or replace function public.clique_find_profile(p_username text)
returns table (id uuid, username text, display_name text, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_path
  from public.clique_profiles p
  where auth.uid() is not null
    and p.username = lower(trim(p_username))
    and p.privacy <> 'private'
    and not public.clique_is_blocked(p.id, auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Invites (homies3 0002 secure-claim design: no anon token lookup; atomic claim RPC).
-- Tokens are stored hashed; the plaintext is returned once by clique_create_invite.
-- ---------------------------------------------------------------------------
create table if not exists public.clique_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  circle_id uuid,                     -- FK added in the circles migration
  max_uses int not null default 1 check (max_uses between 1 and 100),
  uses int not null default 0 check (uses >= 0),
  expires_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);
create index if not exists clique_invites_owner on public.clique_invites (owner_id);

alter table public.clique_invites enable row level security;
drop policy if exists clique_invites_owner_select on public.clique_invites;
create policy clique_invites_owner_select on public.clique_invites
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists clique_invites_owner_delete on public.clique_invites;
create policy clique_invites_owner_delete on public.clique_invites
  for delete to authenticated using (owner_id = auth.uid());
-- Inserts/updates only through the RPCs below (no insert/update policies).

revoke execute on function public.clique_are_friends(uuid, uuid) from public;
revoke execute on function public.clique_is_blocked(uuid, uuid) from public;
revoke execute on function public.clique_can_see_user(uuid) from public;
revoke execute on function public.clique_find_profile(text) from public;
grant execute on function public.clique_are_friends(uuid, uuid) to authenticated;
grant execute on function public.clique_is_blocked(uuid, uuid) to authenticated;
grant execute on function public.clique_can_see_user(uuid) to authenticated;
grant execute on function public.clique_find_profile(text) to authenticated;
