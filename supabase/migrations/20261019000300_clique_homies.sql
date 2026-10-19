-- Clique Phase 2 / 3 of 7: homies (avatar | pet | friend_page), claim codes, events, reels,
-- influence library.

create table if not exists public.clique_homies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('avatar', 'pet', 'friend_page')),
  -- friend_page: the real person the page is about, set when they claim it.
  subject_user_id uuid references auth.users(id) on delete set null,
  claim_code_hash text unique,
  claim_expires_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  name text not null,
  face text not null default '',            -- emoji / preset key (gang v1 face_url)
  portrait_path text,                       -- clique-media/{owner_id}/homies/...
  voice_id text not null default '',
  backstory text not null default '',
  interests text[] not null default '{}',
  stage text not null default 'baby' check (stage in ('egg', 'baby', 'kid', 'teen', 'adult', 'elder')),
  stats jsonb not null default '{}'::jsonb,
  traits jsonb not null default '[]'::jsonb,
  profile jsonb not null default '{}'::jsonb,
  attention smallint not null default 100 check (attention between 0 and 100),
  visibility text not null default 'friends' check (visibility in ('public', 'friends', 'private')),
  legacy_source text,                       -- 'gang:v1', 'homies-cloud', 'homies3'
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clique_homies_name_len check (char_length(name) between 1 and 40),
  constraint clique_homies_backstory_len check (char_length(backstory) <= 2000),
  constraint clique_homies_claim_only_friend_page check (
    kind = 'friend_page' or (claim_code_hash is null and claimed_by is null and subject_user_id is null)
  )
);
create unique index if not exists clique_homies_one_avatar_per_owner
  on public.clique_homies (owner_id) where kind = 'avatar';
create index if not exists clique_homies_owner on public.clique_homies (owner_id);
create index if not exists clique_homies_claimed_by on public.clique_homies (claimed_by);
create unique index if not exists clique_homies_legacy_unique
  on public.clique_homies (owner_id, legacy_source, legacy_id);  -- NULLs distinct: only imported rows collide

alter table public.clique_profiles drop constraint if exists clique_profiles_avatar_homie_fk;
alter table public.clique_profiles add constraint clique_profiles_avatar_homie_fk
  foreign key (avatar_homie_id) references public.clique_homies(id) on delete set null;

drop trigger if exists clique_homies_updated_at on public.clique_homies;
create trigger clique_homies_updated_at before update on public.clique_homies
  for each row execute function public.clique_set_updated_at();

create or replace function public.clique_can_see_homie(p_homie uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clique_homies h
    where h.id = p_homie and auth.uid() is not null and (
      h.owner_id = auth.uid() or h.claimed_by = auth.uid()
      or (not public.clique_is_blocked(h.owner_id, auth.uid()) and (
        h.visibility = 'public'
        or (h.visibility = 'friends' and public.clique_are_friends(h.owner_id, auth.uid()))
      ))
    )
  )
$$;

-- Owner, or the friend who claimed their page.
create or replace function public.clique_can_edit_homie(p_homie uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clique_homies h
    where h.id = p_homie and auth.uid() is not null
      and (h.owner_id = auth.uid() or h.claimed_by = auth.uid())
  )
$$;

-- End users cannot forge ownership, kind, or claim state; those change only via RPCs.
create or replace function public.clique_guard_homie()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.clique_is_trusted() then return new; end if;
  if tg_op = 'INSERT' then
    if new.owner_id <> auth.uid() or new.claim_code_hash is not null or new.claimed_by is not null
       or new.subject_user_id is not null or new.claimed_at is not null then
      raise exception 'invalid homie insert';
    end if;
    return new;
  end if;
  if new.owner_id <> old.owner_id or new.kind <> old.kind
     or new.claim_code_hash is distinct from old.claim_code_hash
     or new.claim_expires_at is distinct from old.claim_expires_at
     or new.claimed_by is distinct from old.claimed_by
     or new.claimed_at is distinct from old.claimed_at
     or new.subject_user_id is distinct from old.subject_user_id then
    raise exception 'homie ownership and claim fields are managed by the server';
  end if;
  return new;
end;
$$;
drop trigger if exists clique_homie_guard on public.clique_homies;
create trigger clique_homie_guard before insert or update on public.clique_homies
  for each row execute function public.clique_guard_homie();

alter table public.clique_homies enable row level security;
drop policy if exists clique_homies_select on public.clique_homies;
create policy clique_homies_select on public.clique_homies
  for select to authenticated
  using (owner_id = auth.uid() or claimed_by = auth.uid() or public.clique_can_see_homie(id));
drop policy if exists clique_homies_insert on public.clique_homies;
create policy clique_homies_insert on public.clique_homies
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists clique_homies_update on public.clique_homies;
create policy clique_homies_update on public.clique_homies
  for update to authenticated
  using (owner_id = auth.uid() or claimed_by = auth.uid())
  with check (owner_id = auth.uid() or claimed_by = auth.uid());
drop policy if exists clique_homies_delete on public.clique_homies;
create policy clique_homies_delete on public.clique_homies
  for delete to authenticated using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Events (evolution, care, narratives, reels...). Append-only for clients.
-- ---------------------------------------------------------------------------
create table if not exists public.clique_homie_events (
  id uuid primary key default gen_random_uuid(),
  homie_id uuid not null references public.clique_homies(id) on delete cascade,
  actor_id uuid default auth.uid() references auth.users(id) on delete set null,
  type text not null check (type in
    ('created', 'evolve', 'episode', 'reel', 'care', 'narrative', 'claimed', 'dial', 'imported')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists clique_homie_events_homie on public.clique_homie_events (homie_id, created_at desc);

alter table public.clique_homie_events enable row level security;
drop policy if exists clique_homie_events_select on public.clique_homie_events;
create policy clique_homie_events_select on public.clique_homie_events
  for select to authenticated using (public.clique_can_see_homie(homie_id));
drop policy if exists clique_homie_events_insert on public.clique_homie_events;
create policy clique_homie_events_insert on public.clique_homie_events
  for insert to authenticated with check (
    actor_id = auth.uid()
    and type not in ('claimed', 'imported')
    and (public.clique_can_edit_homie(homie_id)
         or (type = 'care' and public.clique_can_see_homie(homie_id)))
  );
drop policy if exists clique_homie_events_delete on public.clique_homie_events;
create policy clique_homie_events_delete on public.clique_homie_events
  for delete to authenticated using (
    exists (select 1 from public.clique_homies h where h.id = homie_id and h.owner_id = auth.uid())
  );

create table if not exists public.clique_homie_reels (
  id uuid primary key default gen_random_uuid(),
  homie_id uuid not null references public.clique_homies(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 500),
  mime text not null check (mime ~ '^(image|video)/'),
  storage_path text not null,               -- clique-media/{owner_id}/reels/...
  created_at timestamptz not null default now()
);
create index if not exists clique_homie_reels_homie on public.clique_homie_reels (homie_id, created_at desc);
alter table public.clique_homie_reels enable row level security;
drop policy if exists clique_homie_reels_select on public.clique_homie_reels;
create policy clique_homie_reels_select on public.clique_homie_reels
  for select to authenticated using (public.clique_can_see_homie(homie_id));
drop policy if exists clique_homie_reels_insert on public.clique_homie_reels;
create policy clique_homie_reels_insert on public.clique_homie_reels
  for insert to authenticated with check (
    owner_id = auth.uid() and public.clique_can_edit_homie(homie_id)
    and storage_path like auth.uid()::text || '/%'
  );
drop policy if exists clique_homie_reels_delete on public.clique_homie_reels;
create policy clique_homie_reels_delete on public.clique_homie_reels
  for delete to authenticated using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Friend-page claim codes (homies3 claim design, hashed + expiring + single use)
-- ---------------------------------------------------------------------------
create or replace function public.clique_issue_homie_claim(p_homie uuid, p_ttl_days int default 14)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_code text := public.clique_random_code(10);
begin
  update public.clique_homies
     set claim_code_hash = public.clique_hash_code(v_code),
         claim_expires_at = now() + make_interval(days => greatest(1, least(coalesce(p_ttl_days, 14), 90)))
   where id = p_homie and owner_id = auth.uid() and kind = 'friend_page' and claimed_by is null;
  if not found then
    raise exception 'only the maker of an unclaimed friend page can issue a claim code';
  end if;
  return v_code;
end;
$$;

create or replace function public.clique_claim_homie(p_code text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_owner uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.clique_homies
     set claimed_by = auth.uid(), claimed_at = now(), subject_user_id = auth.uid(),
         claim_code_hash = null, claim_expires_at = null
   where claim_code_hash = public.clique_hash_code(p_code)
     and kind = 'friend_page'
     and claimed_by is null
     and (claim_expires_at is null or claim_expires_at > now())
     and owner_id <> auth.uid()
  returning id, owner_id into v_id, v_owner;
  if v_id is null then raise exception 'claim code not found or expired'; end if;

  insert into public.clique_homie_events (homie_id, actor_id, type, payload)
  values (v_id, auth.uid(), 'claimed', jsonb_build_object('maker_id', v_owner));

  -- Making a page for someone and them claiming it makes you friends.
  insert into public.clique_friendships (requester_id, addressee_id, status)
  values (v_owner, auth.uid(), 'accepted')
  on conflict ((least(requester_id, addressee_id)), (greatest(requester_id, addressee_id)))
  do update set status = 'accepted', blocked_by = null
    where public.clique_friendships.status in ('pending', 'declined');
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Influence library
-- ---------------------------------------------------------------------------
create table if not exists public.clique_influences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  kind text not null default 'other'
    check (kind in ('music', 'book', 'film', 'art', 'place', 'person', 'url', 'other')),
  url text check (url is null or url ~ '^https?://'),
  notes text not null default '' check (char_length(notes) <= 2000),
  tags text[] not null default '{}',
  visibility text not null default 'private' check (visibility in ('public', 'friends', 'private')),
  created_at timestamptz not null default now()
);
create index if not exists clique_influences_owner on public.clique_influences (owner_id);

create or replace function public.clique_can_see_influence(p_influence uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clique_influences i
    where i.id = p_influence and auth.uid() is not null and (
      i.owner_id = auth.uid() or i.visibility = 'public'
      or (i.visibility = 'friends' and public.clique_are_friends(i.owner_id, auth.uid()))
    )
  )
$$;

alter table public.clique_influences enable row level security;
drop policy if exists clique_influences_select on public.clique_influences;
create policy clique_influences_select on public.clique_influences
  for select to authenticated using (owner_id = auth.uid() or public.clique_can_see_influence(id));
drop policy if exists clique_influences_write on public.clique_influences;
create policy clique_influences_write on public.clique_influences
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table if not exists public.clique_homie_influences (
  homie_id uuid not null references public.clique_homies(id) on delete cascade,
  influence_id uuid not null references public.clique_influences(id) on delete cascade,
  weight real not null default 0.5 check (weight between 0 and 1),
  created_at timestamptz not null default now(),
  primary key (homie_id, influence_id)
);
alter table public.clique_homie_influences enable row level security;
drop policy if exists clique_homie_influences_select on public.clique_homie_influences;
create policy clique_homie_influences_select on public.clique_homie_influences
  for select to authenticated using (public.clique_can_see_homie(homie_id));
drop policy if exists clique_homie_influences_write on public.clique_homie_influences;
create policy clique_homie_influences_write on public.clique_homie_influences
  for all to authenticated
  using (public.clique_can_edit_homie(homie_id))
  with check (public.clique_can_edit_homie(homie_id) and public.clique_can_see_influence(influence_id));

revoke execute on function public.clique_can_see_homie(uuid) from public;
revoke execute on function public.clique_can_edit_homie(uuid) from public;
revoke execute on function public.clique_can_see_influence(uuid) from public;
revoke execute on function public.clique_issue_homie_claim(uuid, int) from public;
revoke execute on function public.clique_claim_homie(text) from public;
grant execute on function public.clique_can_see_homie(uuid) to authenticated;
grant execute on function public.clique_can_edit_homie(uuid) to authenticated;
grant execute on function public.clique_can_see_influence(uuid) to authenticated;
grant execute on function public.clique_issue_homie_claim(uuid, int) to authenticated;
grant execute on function public.clique_claim_homie(text) to authenticated;
