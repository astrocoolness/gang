-- Clique Phase 2 / 2 of 7: circles + memberships, invite RPCs (friend and circle invites).

create table if not exists public.clique_circles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  kind text not null default 'friends' check (kind in ('friends', 'space', 'community')),
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  legacy_source text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clique_circles_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
  constraint clique_circles_name_len check (char_length(name) between 1 and 60),
  constraint clique_circles_desc_len check (char_length(description) <= 1000)
);

create table if not exists public.clique_circle_members (
  circle_id uuid not null references public.clique_circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create index if not exists clique_circle_members_user on public.clique_circle_members (user_id);

alter table public.clique_invites
  drop constraint if exists clique_invites_circle_fk;
alter table public.clique_invites
  add constraint clique_invites_circle_fk foreign key (circle_id)
  references public.clique_circles(id) on delete cascade;

drop trigger if exists clique_circles_updated_at on public.clique_circles;
create trigger clique_circles_updated_at before update on public.clique_circles
  for each row execute function public.clique_set_updated_at();

create or replace function public.clique_circle_role(p_circle uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role from public.clique_circle_members m
  where m.circle_id = p_circle and m.user_id = auth.uid()
$$;

create or replace function public.clique_is_circle_member(p_circle uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.clique_circle_role(p_circle) is not null $$;

create or replace function public.clique_circle_is_public(p_circle uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.clique_circles c where c.id = p_circle and c.visibility = 'public') $$;

-- Creator becomes owner automatically.
create or replace function public.clique_circle_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.clique_circle_members (circle_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (circle_id, user_id) do update set role = 'owner';
  return new;
end;
$$;
drop trigger if exists clique_circle_owner on public.clique_circles;
create trigger clique_circle_owner after insert on public.clique_circles
  for each row execute function public.clique_circle_after_insert();

-- Membership guard: users cannot promote themselves; only owners grant admin/owner;
-- a circle keeps at least one owner.
create or replace function public.clique_guard_circle_member()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  my_role text;
begin
  if public.clique_is_trusted() then return coalesce(new, old); end if;
  my_role := public.clique_circle_role(coalesce(new.circle_id, old.circle_id));

  if tg_op = 'INSERT' then
    if new.user_id = auth.uid() then
      -- self-join: public circles only, as plain member (private circles use invites)
      if new.role <> 'member' or not public.clique_circle_is_public(new.circle_id) then
        raise exception 'join private circles with an invite';
      end if;
    elsif my_role not in ('owner', 'admin') then
      raise exception 'only circle admins may add members';
    elsif new.role <> 'member' and my_role <> 'owner' then
      raise exception 'only owners may grant admin roles';
    elsif not public.clique_are_friends(auth.uid(), new.user_id) then
      raise exception 'you can only add friends directly; send an invite instead';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.circle_id <> old.circle_id or new.user_id <> old.user_id then
      raise exception 'membership identity is immutable';
    end if;
    if my_role is distinct from 'owner' then
      raise exception 'only owners may change roles';
    end if;
    if old.role = 'owner' and new.role <> 'owner' and not exists (
      select 1 from public.clique_circle_members m
      where m.circle_id = old.circle_id and m.role = 'owner' and m.user_id <> old.user_id
    ) then
      raise exception 'a circle needs at least one owner';
    end if;
    return new;
  end if;

  -- DELETE: leave yourself, or admins remove members (owners remove admins).
  if old.user_id <> auth.uid() then
    if my_role not in ('owner', 'admin') or (old.role <> 'member' and my_role <> 'owner') then
      raise exception 'not allowed to remove this member';
    end if;
  end if;
  if old.role = 'owner' and not exists (
    select 1 from public.clique_circle_members m
    where m.circle_id = old.circle_id and m.role = 'owner' and m.user_id <> old.user_id
  ) then
    raise exception 'transfer ownership before the last owner leaves';
  end if;
  return old;
end;
$$;
drop trigger if exists clique_circle_member_guard on public.clique_circle_members;
create trigger clique_circle_member_guard
  before insert or update or delete on public.clique_circle_members
  for each row execute function public.clique_guard_circle_member();

alter table public.clique_circles enable row level security;
alter table public.clique_circle_members enable row level security;

drop policy if exists clique_circles_select on public.clique_circles;
create policy clique_circles_select on public.clique_circles
  for select to authenticated
  using (visibility = 'public' or created_by = auth.uid() or public.clique_is_circle_member(id));
drop policy if exists clique_circles_insert on public.clique_circles;
create policy clique_circles_insert on public.clique_circles
  for insert to authenticated with check (created_by = auth.uid());
drop policy if exists clique_circles_update on public.clique_circles;
create policy clique_circles_update on public.clique_circles
  for update to authenticated
  using (public.clique_circle_role(id) in ('owner', 'admin'))
  with check (public.clique_circle_role(id) in ('owner', 'admin'));
drop policy if exists clique_circles_delete on public.clique_circles;
create policy clique_circles_delete on public.clique_circles
  for delete to authenticated using (public.clique_circle_role(id) = 'owner');

drop policy if exists clique_circle_members_select on public.clique_circle_members;
create policy clique_circle_members_select on public.clique_circle_members
  for select to authenticated
  using (public.clique_is_circle_member(circle_id) or public.clique_circle_is_public(circle_id));
drop policy if exists clique_circle_members_insert on public.clique_circle_members;
create policy clique_circle_members_insert on public.clique_circle_members
  for insert to authenticated
  with check (user_id = auth.uid() or public.clique_circle_role(circle_id) in ('owner', 'admin'));
drop policy if exists clique_circle_members_update on public.clique_circle_members;
create policy clique_circle_members_update on public.clique_circle_members
  for update to authenticated
  using (public.clique_circle_role(circle_id) = 'owner')
  with check (public.clique_circle_role(circle_id) = 'owner');
drop policy if exists clique_circle_members_delete on public.clique_circle_members;
create policy clique_circle_members_delete on public.clique_circle_members
  for delete to authenticated
  using (user_id = auth.uid() or public.clique_circle_role(circle_id) in ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- Invite RPCs
-- ---------------------------------------------------------------------------
-- Returns the plaintext token ONCE; only its hash is stored.
create or replace function public.clique_create_invite(
  p_circle uuid default null,
  p_max_uses int default 1,
  p_ttl_days int default 14
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_token text := public.clique_random_code(24);
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_circle is not null and public.clique_circle_role(p_circle) not in ('owner', 'admin') then
    raise exception 'only circle admins may create circle invites';
  end if;
  insert into public.clique_invites (owner_id, token_hash, circle_id, max_uses, expires_at)
  values (auth.uid(), public.clique_hash_code(v_token), p_circle,
          greatest(1, least(coalesce(p_max_uses, 1), 100)),
          now() + make_interval(days => greatest(1, least(coalesce(p_ttl_days, 14), 90))));
  return v_token;
end;
$$;

-- Atomic claim: consume one use, befriend the inviter, and join the circle if any.
create or replace function public.clique_claim_invite(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_inviter uuid;
  v_circle uuid;
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'authentication required'; end if;

  update public.clique_invites
     set uses = uses + 1
   where token_hash = public.clique_hash_code(p_token)
     and (expires_at is null or expires_at > now())
     and uses < max_uses
     and owner_id <> v_me
  returning owner_id, circle_id into v_inviter, v_circle;

  if v_inviter is null then
    raise exception 'invite not found or expired';
  end if;
  if public.clique_is_blocked(v_inviter, v_me) then
    raise exception 'invite not found or expired';
  end if;

  insert into public.clique_friendships (requester_id, addressee_id, status)
  values (v_inviter, v_me, 'accepted')
  on conflict ((least(requester_id, addressee_id)), (greatest(requester_id, addressee_id)))
  do update set status = 'accepted', blocked_by = null
    where public.clique_friendships.status in ('pending', 'declined');

  if v_circle is not null then
    insert into public.clique_circle_members (circle_id, user_id, role)
    values (v_circle, v_me, 'member')
    on conflict do nothing;
  end if;

  return jsonb_build_object('inviter_id', v_inviter, 'circle_id', v_circle);
end;
$$;

revoke execute on function public.clique_circle_role(uuid) from public;
revoke execute on function public.clique_is_circle_member(uuid) from public;
revoke execute on function public.clique_circle_is_public(uuid) from public;
revoke execute on function public.clique_create_invite(uuid, int, int) from public;
revoke execute on function public.clique_claim_invite(text) from public;
grant execute on function public.clique_circle_role(uuid) to authenticated;
grant execute on function public.clique_is_circle_member(uuid) to authenticated;
grant execute on function public.clique_circle_is_public(uuid) to authenticated;
grant execute on function public.clique_create_invite(uuid, int, int) to authenticated;
grant execute on function public.clique_claim_invite(text) to authenticated;
