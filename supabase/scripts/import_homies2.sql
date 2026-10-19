-- HOMIES² -> Clique importer (same Supabase project: rva.guru = oesdpdcncwdjnfvludxx).
--
-- NOT a migration: lives outside supabase/migrations so `supabase db push` never applies it.
-- Run manually in the SQL editor (as postgres) AFTER the Clique migrations, on staging first:
--
--   \i supabase/scripts/import_homies2.sql          -- or paste this file: defines the function only
--   select public.clique_import_homies2();          -- DRY RUN (default): returns counts, writes nothing
--   select public.clique_import_homies2(true);      -- APPLY: writes; safe to re-run (idempotent)
--   drop function public.clique_import_homies2(boolean);   -- when finished
--
-- Same project means auth.users ids are reused directly: no email matching, no invites, no keys.
-- Mapping
--   homies_profiles            -> clique_profiles (username from handle; collisions get _2, _3 ...)
--   avatar_url tony/betty/nori -> clique_homies kind='avatar' (+ clique_profiles.avatar_homie_id)
--   homies_connections         -> clique_friendships (pending/accepted/blocked kept; others -> pending)
--   homies_threads + members   -> clique_threads dm|group + clique_thread_members
--                                 (an existing Clique DM for the same pair is reused, history merged)
--   homies_messages            -> clique_messages kind='text' (legacy chat is text)
--   homies_contacts            -> NOT imported (private phone book; needs its own consented flow)
--   homies_profile_links       -> NOT imported yet (follow-up: Mehspace links)
-- Idempotent: rows carry legacy_source='homies2' + legacy_id; existing rows are skipped
-- (ON CONFLICT DO NOTHING). Existing Clique profiles are never overwritten.
--
-- VERIFY: the HOMIES² SQL isn't in its repo; column names are inferred from homies2/app.js + README.
-- Optional/uncertain columns are read via to_jsonb(row)->>'col', so a missing column becomes NULL
-- instead of an error. Columns read directly (must exist):
--   homies_profiles(id), homies_connections(requester_id, addressee_id, status),
--   homies_threads(id), homies_thread_members(thread_id, user_id),
--   homies_messages(id, thread_id, sender_id, body, created_at)

create or replace function public.clique_import_homies2(p_apply boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profiles int := 0;
  v_avatars int := 0;
  v_friendships int := 0;
  v_threads int := 0;
  v_dm_merged int := 0;
  v_members int := 0;
  v_messages int := 0;
  v_skipped_users int := 0;
  n int;
  r record;
  t record;
  v_base text;
  v_username text;
  v_i int;
  v_members_arr uuid[];
  v_kind text;
  v_key text;
  v_thread uuid;
begin
  begin  -- inner block: rolled back on dry run
    -- 1. Profiles (only real auth users without a Clique profile yet).
    select count(*) into v_skipped_users
    from public.homies_profiles hp
    where not exists (select 1 from auth.users u where u.id = hp.id);

    for r in
      select hp.id,
             to_jsonb(hp) ->> 'handle' as handle,           -- VERIFY
             to_jsonb(hp) ->> 'display_name' as display_name, -- VERIFY
             to_jsonb(hp) ->> 'bio' as bio,                  -- VERIFY
             to_jsonb(hp) ->> 'status_text' as status_text,  -- VERIFY
             to_jsonb(hp) ->> 'avatar_url' as avatar_url,    -- VERIFY
             coalesce((to_jsonb(hp) ->> 'created_at')::timestamptz, now()) as created_at -- VERIFY
      from public.homies_profiles hp
      join auth.users u on u.id = hp.id
      where not exists (select 1 from public.clique_profiles cp where cp.id = hp.id)
      order by 7
    loop
      v_base := regexp_replace(lower(coalesce(nullif(r.handle, ''), nullif(r.display_name, ''), 'homie')), '^@', '');
      v_base := trim(both '_' from regexp_replace(v_base, '[^a-z0-9_]+', '_', 'g'));
      v_base := left(v_base, 24);
      if char_length(v_base) < 3 then v_base := left(v_base || '_homie', 24); end if;
      v_username := v_base;
      v_i := 2;
      while exists (select 1 from public.clique_profiles where username = v_username) loop
        v_username := left(v_base, 24 - char_length(v_i::text) - 1) || '_' || v_i;
        v_i := v_i + 1;
      end loop;

      insert into public.clique_profiles
        (id, username, display_name, bio, status, privacy, onboarded_at, legacy_source, legacy_id, created_at)
      values
        (r.id, v_username, left(coalesce(nullif(trim(r.display_name), ''), v_username), 60),
         left(coalesce(r.bio, ''), 500), left(coalesce(r.status_text, ''), 80), 'friends', now(),
         'homies2', r.id::text, r.created_at)
      on conflict do nothing;
      get diagnostics n = row_count;
      v_profiles := v_profiles + n;

      if n > 0 and r.avatar_url ~ '(tony|betty|nori)' then
        insert into public.clique_homies (owner_id, kind, name, face, profile, legacy_source, legacy_id)
        values (r.id, 'avatar', initcap(substring(r.avatar_url from '(tony|betty|nori)')),
                substring(r.avatar_url from '(tony|betty|nori)'),
                jsonb_build_object('homies2_avatar_url', r.avatar_url), 'homies2', 'avatar:' || r.id)
        on conflict do nothing;
        get diagnostics n = row_count;
        v_avatars := v_avatars + n;
        update public.clique_profiles p
           set avatar_homie_id = h.id
          from public.clique_homies h
         where p.id = r.id and p.avatar_homie_id is null
           and h.owner_id = r.id and h.legacy_source = 'homies2' and h.legacy_id = 'avatar:' || r.id;
      end if;
    end loop;

    -- 2. Friendships (both ends must be real users; one row per pair).
    insert into public.clique_friendships (requester_id, addressee_id, status, blocked_by, created_at)
    select distinct on (least(c.requester_id, c.addressee_id), greatest(c.requester_id, c.addressee_id))
           c.requester_id, c.addressee_id,
           case when c.status in ('pending', 'accepted', 'blocked') then c.status else 'pending' end,
           case when c.status = 'blocked'
                then coalesce((to_jsonb(c) ->> 'blocked_by')::uuid, c.requester_id) end,  -- VERIFY
           coalesce((to_jsonb(c) ->> 'created_at')::timestamptz, now())
    from public.homies_connections c
    join auth.users a on a.id = c.requester_id
    join auth.users b on b.id = c.addressee_id
    where c.requester_id <> c.addressee_id
    order by least(c.requester_id, c.addressee_id), greatest(c.requester_id, c.addressee_id),
             (c.status = 'accepted') desc
    on conflict do nothing;
    get diagnostics v_friendships = row_count;
    -- Don't flood Home with "became friends" for old HOMIES² connections.
    -- (activities written in this transaction, now() = txn start, for pairs that came from HOMIES²)
    delete from public.clique_activities a
     using public.clique_friendships f, public.homies_connections c
     where a.verb = 'befriended' and a.object_id = f.id and a.created_at = now()
       and least(f.requester_id, f.addressee_id) = least(c.requester_id, c.addressee_id)
       and greatest(f.requester_id, f.addressee_id) = greatest(c.requester_id, c.addressee_id);

    -- 3. Threads + members.
    create temp table if not exists _clique_h2_thread_map (legacy_id text primary key, thread_id uuid not null)
      on commit drop;
    truncate _clique_h2_thread_map;

    for t in
      select ht.id,
             to_jsonb(ht) ->> 'title' as title,            -- VERIFY (may be 'name')
             to_jsonb(ht) ->> 'kind' as kind,              -- VERIFY (may be 'is_group')
             (to_jsonb(ht) ->> 'created_by')::uuid as created_by,  -- VERIFY
             coalesce((to_jsonb(ht) ->> 'created_at')::timestamptz, now()) as created_at
      from public.homies_threads ht
    loop
      select array_agg(distinct m.user_id order by m.user_id) into v_members_arr
      from public.homies_thread_members m
      join auth.users u on u.id = m.user_id
      where m.thread_id = t.id;
      continue when v_members_arr is null;

      v_kind := case when cardinality(v_members_arr) = 2 and coalesce(t.kind, '') <> 'group' then 'dm' else 'group' end;
      v_key := case when v_kind = 'dm' then v_members_arr[1]::text || ':' || v_members_arr[2]::text end;

      select id into v_thread from public.clique_threads
       where (legacy_source = 'homies2' and legacy_id = t.id::text) or (v_key is not null and dm_key = v_key)
       order by (legacy_id = t.id::text) desc nulls last
       limit 1;
      if v_thread is null then
        insert into public.clique_threads (kind, dm_key, title, created_by, legacy_source, legacy_id, created_at)
        values (v_kind, v_key, left(coalesce(t.title, ''), 80),
                case when exists (select 1 from auth.users where id = t.created_by) then t.created_by end,
                'homies2', t.id::text, t.created_at)
        returning id into v_thread;
        v_threads := v_threads + 1;
      elsif v_key is not null and not exists (
        select 1 from public.clique_threads where id = v_thread and legacy_id = t.id::text) then
        v_dm_merged := v_dm_merged + 1;
      end if;
      insert into _clique_h2_thread_map values (t.id::text, v_thread) on conflict do nothing;

      insert into public.clique_thread_members (thread_id, user_id, role)
      select v_thread, u, case when u = t.created_by and v_kind = 'group' then 'owner' else 'member' end
      from unnest(v_members_arr) as u
      on conflict do nothing;
      get diagnostics n = row_count;
      v_members := v_members + n;
    end loop;

    -- 4. Messages (text; empty bodies skipped).
    insert into public.clique_messages (thread_id, sender_id, kind, body, created_at, legacy_source, legacy_id)
    select map.thread_id,
           case when exists (select 1 from auth.users u where u.id = hm.sender_id) then hm.sender_id end,
           'text', left(hm.body, 4000), hm.created_at, 'homies2', hm.id::text
    from public.homies_messages hm
    join _clique_h2_thread_map map on map.legacy_id = hm.thread_id::text
    where coalesce(trim(hm.body), '') <> ''
    on conflict do nothing;
    get diagnostics v_messages = row_count;

    update public.clique_threads ct
       set last_message_at = s.max_at
      from (select thread_id, max(created_at) as max_at from public.clique_messages group by thread_id) s
     where ct.id = s.thread_id and ct.id in (select thread_id from _clique_h2_thread_map);

    if not p_apply then
      raise exception using errcode = 'CQ001', message = 'dry run rollback';
    end if;
  exception when sqlstate 'CQ001' then
    null;  -- dry run: everything above is rolled back, counts are kept
  end;

  return jsonb_build_object(
    'mode', case when p_apply then 'apply' else 'dry_run' end,
    'profiles', v_profiles, 'avatar_homies', v_avatars, 'friendships', v_friendships,
    'threads_created', v_threads, 'dm_threads_merged', v_dm_merged, 'thread_members', v_members,
    'messages', v_messages, 'homies2_profiles_without_auth_user', v_skipped_users,
    'contacts', 'skipped (private)');
end;
$$;

-- Operator-only: never callable through the API.
revoke execute on function public.clique_import_homies2(boolean) from public, anon, authenticated;
