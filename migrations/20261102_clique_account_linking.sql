-- STAGED ONLY. DO NOT APPLY WITHOUT DB OWNER APPROVAL, BACKUP AND ROLLBACK.
-- These tables are deliberately inaccessible to anon/authenticated through Data API.
-- The two RPCs are invoker (NOT definer) and callable only by service_role.

create table if not exists public.clique_link_challenges (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  app_key text not null default 'homies' check (app_key = 'homies'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (expires_at > created_at)
);
create index if not exists clique_link_challenges_owner_created
  on public.clique_link_challenges (owner_id, created_at desc);

create table if not exists public.clique_account_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  app_key text not null default 'homies' check (app_key = 'homies'),
  external_subject text not null
    check (char_length(external_subject) between 3 and 128
      and external_subject ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:@-]{2,127}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index if not exists clique_account_links_active_owner
  on public.clique_account_links (owner_id, app_key) where revoked_at is null;
create unique index if not exists clique_account_links_active_subject
  on public.clique_account_links (app_key, external_subject) where revoked_at is null;

alter table public.clique_link_challenges enable row level security;
alter table public.clique_account_links enable row level security;
revoke all on public.clique_link_challenges, public.clique_account_links
  from public, anon, authenticated;
grant select, insert, update, delete on public.clique_link_challenges, public.clique_account_links
  to service_role;

create or replace function public.clique_link_start(p_owner_id uuid, p_challenge_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_owner_id is null or p_challenge_id is null then return 'invalid'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('clique:' || p_owner_id::text, 0));
  select count(*) into v_count
  from public.clique_link_challenges
  where owner_id = p_owner_id and created_at > now() - interval '10 minutes';
  if v_count >= 5 then return 'rate_limited'; end if;
  insert into public.clique_link_challenges (id, owner_id, expires_at)
    values (p_challenge_id, p_owner_id, now() + interval '10 minutes');
  return 'issued';
exception when foreign_key_violation then
  return 'invalid';
end;
$$;

create or replace function public.clique_link_complete(p_challenge_id uuid, p_external_subject text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_challenge public.clique_link_challenges%rowtype;
  v_subject_owner uuid;
  v_owner_subject text;
begin
  if p_challenge_id is null or p_external_subject is null or
    char_length(p_external_subject) not between 3 and 128 or
    p_external_subject !~ '^[a-zA-Z0-9][a-zA-Z0-9_.:@-]{2,127}$'
  then return 'invalid'; end if;
  select * into v_challenge from public.clique_link_challenges
    where id = p_challenge_id for update;
  if not found or v_challenge.consumed_at is not null or
     v_challenge.expires_at <= now() then return 'expired'; end if;
  -- Serialize updates for the owner, including parallel challenge completes.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('clique:' || v_challenge.owner_id::text, 0));
  select owner_id into v_subject_owner from public.clique_account_links
    where app_key = 'homies' and external_subject = p_external_subject
      and revoked_at is null for update;
  if found and v_subject_owner <> v_challenge.owner_id then return 'conflict'; end if;
  select external_subject into v_owner_subject from public.clique_account_links
    where owner_id = v_challenge.owner_id and app_key = 'homies'
      and revoked_at is null for update;
  if found and v_owner_subject <> p_external_subject then return 'conflict'; end if;

  if v_subject_owner = v_challenge.owner_id or v_owner_subject = p_external_subject then
    update public.clique_link_challenges set consumed_at = now() where id = p_challenge_id;
    return 'already_linked';
  end if;
  insert into public.clique_account_links(owner_id, app_key, external_subject)
    values (v_challenge.owner_id, 'homies', p_external_subject);
  update public.clique_link_challenges set consumed_at = now() where id = p_challenge_id;
  return 'linked';
exception when unique_violation then
  return 'conflict';
end;
$$;

create or replace function public.clique_link_revoke(p_owner_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_owner_id is null then return 'invalid'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('clique:' || p_owner_id::text, 0));
  update public.clique_account_links set revoked_at = now()
    where owner_id = p_owner_id and app_key = 'homies' and revoked_at is null;
  update public.clique_link_challenges set consumed_at = now()
    where owner_id = p_owner_id and consumed_at is null;
  return 'revoked';
end;
$$;

revoke all on function public.clique_link_start(uuid, uuid) from public, anon, authenticated;
revoke all on function public.clique_link_complete(uuid, text) from public, anon, authenticated;
revoke all on function public.clique_link_revoke(uuid) from public, anon, authenticated;
grant execute on function public.clique_link_start(uuid, uuid) to service_role;
grant execute on function public.clique_link_complete(uuid, text) to service_role;
grant execute on function public.clique_link_revoke(uuid) to service_role;

-- Required before approval: test as anon, authenticated and service_role;
-- verify RLS, migration rollback, auth.cookies, site origin, and connection flow.
