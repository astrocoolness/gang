-- Clique Phase 2 / 5 of 7: Dial — threads (dm | group | circle), members, messages
-- (picture messages by default), dial sessions. Threads are created only via RPCs.

create table if not exists public.clique_threads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('dm', 'group', 'circle')),
  circle_id uuid unique references public.clique_circles(id) on delete cascade,
  dm_key text unique,                       -- 'least_uuid:greatest_uuid' for DMs
  title text not null default '' check (char_length(title) <= 80),
  created_by uuid references auth.users(id) on delete set null,
  legacy_source text,
  legacy_id text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  constraint clique_threads_shape check (
    (kind = 'dm' and dm_key is not null and circle_id is null)
    or (kind = 'group' and dm_key is null and circle_id is null)
    or (kind = 'circle' and circle_id is not null and dm_key is null)
  )
);
create unique index if not exists clique_threads_legacy_unique
  on public.clique_threads (legacy_source, legacy_id);  -- NULLs distinct: only imported rows collide

-- Circle threads derive membership from clique_circle_members (no rows here).
create table if not exists public.clique_thread_members (
  thread_id uuid not null references public.clique_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  last_read_at timestamptz,
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);
create index if not exists clique_thread_members_user on public.clique_thread_members (user_id);

create table if not exists public.clique_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.clique_threads(id) on delete cascade,
  sender_id uuid default auth.uid() references auth.users(id) on delete set null,
  as_homie_id uuid references public.clique_homies(id) on delete set null,
  kind text not null default 'image' check (kind in ('image', 'text', 'system')),
  body text not null default '' check (char_length(body) <= 4000),
  image_path text,                          -- clique-chat/{thread_id}/{sender_id}/{file}
  image_width int check (image_width is null or image_width > 0),
  image_height int check (image_height is null or image_height > 0),
  image_alt text not null default '' check (char_length(image_alt) <= 500),
  rewrite_meta jsonb,                       -- rotary-dial rewrite settings, if used
  gen_meta jsonb,                           -- image generation prompt/model, if generated
  attention_cost smallint not null default 0 check (attention_cost between 0 and 100),
  legacy_source text,
  legacy_id text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint clique_messages_image_required check (kind <> 'image' or image_path is not null),
  constraint clique_messages_text_required check (kind <> 'text' or char_length(body) > 0),
  constraint clique_messages_image_path_scoped check (
    image_path is null or image_path like thread_id::text || '/%'
  )
);
create index if not exists clique_messages_thread on public.clique_messages (thread_id, created_at desc);
create unique index if not exists clique_messages_legacy_unique
  on public.clique_messages (legacy_source, legacy_id);  -- NULLs distinct: only imported rows collide

create table if not exists public.clique_dial_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  homie_id uuid references public.clique_homies(id) on delete set null,
  thread_id uuid references public.clique_threads(id) on delete set null,
  attention_cost smallint not null default 0 check (attention_cost between 0 and 100),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create or replace function public.clique_is_thread_member(p_thread uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.clique_thread_members m
            where m.thread_id = p_thread and m.user_id = auth.uid())
    or exists (select 1 from public.clique_threads t
               join public.clique_circle_members cm on cm.circle_id = t.circle_id
               where t.id = p_thread and t.kind = 'circle' and cm.user_id = auth.uid())
  )
$$;

-- Message guard: immutable routing fields; senders may edit body or soft-delete only.
create or replace function public.clique_guard_message()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.clique_is_trusted() then return new; end if;
  if tg_op = 'INSERT' then
    if new.kind = 'system' then raise exception 'system messages are server-only'; end if;
    if new.image_path is not null and new.image_path not like new.thread_id::text || '/' || auth.uid()::text || '/%' then
      raise exception 'image must be uploaded under {thread_id}/{your_user_id}/';
    end if;
    new.edited_at := null; new.deleted_at := null; new.created_at := now();
    return new;
  end if;
  if new.thread_id <> old.thread_id or new.sender_id is distinct from old.sender_id
     or new.kind <> old.kind or new.image_path is distinct from old.image_path
     or new.created_at <> old.created_at or new.as_homie_id is distinct from old.as_homie_id then
    raise exception 'only body/alt can be edited';
  end if;
  new.edited_at := now();
  return new;
end;
$$;
drop trigger if exists clique_message_guard on public.clique_messages;
create trigger clique_message_guard before insert or update on public.clique_messages
  for each row execute function public.clique_guard_message();

create or replace function public.clique_message_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clique_threads set last_message_at = new.created_at where id = new.thread_id;
  return new;
end;
$$;
drop trigger if exists clique_message_touch_thread on public.clique_messages;
create trigger clique_message_touch_thread after insert on public.clique_messages
  for each row execute function public.clique_message_after_insert();

-- Circle -> group thread, created automatically.
create or replace function public.clique_circle_thread_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.clique_threads (kind, circle_id, title, created_by)
  values ('circle', new.id, new.name, new.created_by)
  on conflict (circle_id) do nothing;
  return new;
end;
$$;
drop trigger if exists clique_circle_thread on public.clique_circles;
create trigger clique_circle_thread after insert on public.clique_circles
  for each row execute function public.clique_circle_thread_after_insert();

alter table public.clique_threads enable row level security;
alter table public.clique_thread_members enable row level security;
alter table public.clique_messages enable row level security;
alter table public.clique_dial_sessions enable row level security;

drop policy if exists clique_threads_select on public.clique_threads;
create policy clique_threads_select on public.clique_threads
  for select to authenticated using (public.clique_is_thread_member(id));
drop policy if exists clique_threads_update on public.clique_threads;
create policy clique_threads_update on public.clique_threads
  for update to authenticated
  using (kind = 'group' and exists (select 1 from public.clique_thread_members m
         where m.thread_id = clique_threads.id and m.user_id = auth.uid() and m.role = 'owner'))
  with check (kind = 'group');
-- No insert/delete policies: use clique_start_dm / clique_create_group.

drop policy if exists clique_thread_members_select on public.clique_thread_members;
create policy clique_thread_members_select on public.clique_thread_members
  for select to authenticated using (public.clique_is_thread_member(thread_id));
drop policy if exists clique_thread_members_update_self on public.clique_thread_members;
create policy clique_thread_members_update_self on public.clique_thread_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists clique_thread_members_leave on public.clique_thread_members;
create policy clique_thread_members_leave on public.clique_thread_members
  for delete to authenticated using (user_id = auth.uid());

create or replace function public.clique_guard_thread_member()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.clique_is_trusted() then return new; end if;
  if new.thread_id <> old.thread_id or new.user_id <> old.user_id or new.role <> old.role
     or new.joined_at <> old.joined_at then
    raise exception 'you can only update last_read_at and muted';
  end if;
  return new;
end;
$$;
drop trigger if exists clique_thread_member_guard on public.clique_thread_members;
create trigger clique_thread_member_guard before update on public.clique_thread_members
  for each row execute function public.clique_guard_thread_member();

drop policy if exists clique_messages_select on public.clique_messages;
create policy clique_messages_select on public.clique_messages
  for select to authenticated using (public.clique_is_thread_member(thread_id));
drop policy if exists clique_messages_insert on public.clique_messages;
create policy clique_messages_insert on public.clique_messages
  for insert to authenticated with check (
    sender_id = auth.uid() and public.clique_is_thread_member(thread_id)
    and (as_homie_id is null or public.clique_can_edit_homie(as_homie_id))
  );
drop policy if exists clique_messages_update on public.clique_messages;
create policy clique_messages_update on public.clique_messages
  for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());
drop policy if exists clique_messages_delete on public.clique_messages;
create policy clique_messages_delete on public.clique_messages
  for delete to authenticated using (sender_id = auth.uid());

drop policy if exists clique_dial_sessions_own on public.clique_dial_sessions;
create policy clique_dial_sessions_own on public.clique_dial_sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Thread RPCs
-- ---------------------------------------------------------------------------
create or replace function public.clique_start_dm(p_other uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_key text;
  v_id uuid;
begin
  if v_me is null then raise exception 'authentication required'; end if;
  if p_other is null or p_other = v_me then raise exception 'pick someone else'; end if;
  if not public.clique_are_friends(v_me, p_other) then
    raise exception 'you can only Dial friends';
  end if;
  v_key := least(v_me, p_other)::text || ':' || greatest(v_me, p_other)::text;
  insert into public.clique_threads (kind, dm_key, created_by) values ('dm', v_key, v_me)
  on conflict (dm_key) do update set dm_key = excluded.dm_key
  returning id into v_id;
  insert into public.clique_thread_members (thread_id, user_id, role)
  values (v_id, v_me, 'member'), (v_id, p_other, 'member')
  on conflict do nothing;
  return v_id;
end;
$$;

create or replace function public.clique_create_group(p_title text, p_members uuid[])
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
  v_member uuid;
begin
  if v_me is null then raise exception 'authentication required'; end if;
  if coalesce(cardinality(p_members), 0) < 1 or cardinality(p_members) > 50 then
    raise exception 'groups need 1-50 other members';
  end if;
  insert into public.clique_threads (kind, title, created_by)
  values ('group', left(coalesce(p_title, ''), 80), v_me) returning id into v_id;
  insert into public.clique_thread_members (thread_id, user_id, role) values (v_id, v_me, 'owner');
  foreach v_member in array p_members loop
    if v_member <> v_me then
      if not public.clique_are_friends(v_me, v_member) then
        raise exception 'you can only add friends to a group';
      end if;
      insert into public.clique_thread_members (thread_id, user_id) values (v_id, v_member)
      on conflict do nothing;
    end if;
  end loop;
  return v_id;
end;
$$;

create or replace function public.clique_add_group_member(p_thread uuid, p_user uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.clique_threads t join public.clique_thread_members m
                 on m.thread_id = t.id
                 where t.id = p_thread and t.kind = 'group' and m.user_id = auth.uid()) then
    raise exception 'not a member of this group';
  end if;
  if not public.clique_are_friends(auth.uid(), p_user) then
    raise exception 'you can only add friends to a group';
  end if;
  insert into public.clique_thread_members (thread_id, user_id) values (p_thread, p_user)
  on conflict do nothing;
end;
$$;

-- Realtime for Dial (Supabase publication exists on hosted projects).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.clique_messages;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;

revoke execute on function public.clique_is_thread_member(uuid) from public;
revoke execute on function public.clique_start_dm(uuid) from public;
revoke execute on function public.clique_create_group(text, uuid[]) from public;
revoke execute on function public.clique_add_group_member(uuid, uuid) from public;
grant execute on function public.clique_is_thread_member(uuid) to authenticated;
grant execute on function public.clique_start_dm(uuid) to authenticated;
grant execute on function public.clique_create_group(text, uuid[]) to authenticated;
grant execute on function public.clique_add_group_member(uuid, uuid) to authenticated;
