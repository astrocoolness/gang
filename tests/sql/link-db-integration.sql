-- CI ONLY, executed after bootstrap and unapplied migration on ephemeral Postgres.
-- A failed assertion raises an exception, failing the GitHub Actions job.
do $$
begin
  if pg_catalog.has_table_privilege('anon','public.clique_account_links','select')
     or pg_catalog.has_table_privilege('authenticated','public.clique_account_links','select') then
    raise exception 'client role can read private link data';
  end if;
  if pg_catalog.has_function_privilege('anon','public.clique_link_complete(uuid,text)','execute')
     or pg_catalog.has_function_privilege('authenticated','public.clique_link_complete(uuid,text)','execute') then
    raise exception 'client role can run privileged link RPC';
  end if;
  if not pg_catalog.has_function_privilege('service_role','public.clique_link_complete(uuid,text)','execute') then
    raise exception 'privileged role cannot run required link RPC';
  end if;
end
$$;

set role service_role;
do $$
declare
  owner_a uuid := '11111111-1111-4111-8111-111111111111';
  owner_b uuid := '22222222-2222-4222-8222-222222222222';
  owner_c uuid := '33333333-3333-4333-8333-333333333333';
  c1 uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  c2 uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  c3 uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  c4 uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  c5 uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
  i int;
  challenge uuid;
begin
  if public.clique_link_start(owner_a,c1) <> 'issued' then raise exception 'start failed'; end if;
  if public.clique_link_complete(c1,'homies_person_a') <> 'linked' then raise exception 'complete failed'; end if;
  if public.clique_link_complete(c1,'homies_person_a') <> 'expired' then raise exception 'replay not rejected'; end if;
  if public.clique_link_start(owner_a,c2) <> 'issued' then raise exception 'second start failed'; end if;
  if public.clique_link_complete(c2,'homies_person_a') <> 'already_linked' then raise exception 'idempotent same-owner link failed'; end if;
  if public.clique_link_start(owner_b,c3) <> 'issued' then raise exception 'other owner start failed'; end if;
  if public.clique_link_complete(c3,'homies_person_a') <> 'conflict' then raise exception 'other owner takeover not rejected'; end if;
  if public.clique_link_revoke(owner_a) <> 'revoked' then raise exception 'revoke failed'; end if;
  if exists(select 1 from public.clique_account_links where owner_id=owner_a and revoked_at is null) then
    raise exception 'revocation did not remove active mapping';
  end if;
  if public.clique_link_complete(c3,'homies_person_a') <> 'linked' then
    raise exception 'a revoked identity cannot be re-linked by its next confirmed owner';
  end if;
  if public.clique_link_start(owner_c,c4) <> 'issued' then raise exception 'expiry test start failed'; end if;
  update public.clique_link_challenges
    set created_at=now()-interval '30 minutes', expires_at=now()-interval '20 minutes'
    where id=c4;
  if public.clique_link_complete(c4,'homies_person_c') <> 'expired' then raise exception 'expired challenge accepted'; end if;
  if public.clique_link_complete(c4,'x') <> 'invalid' then raise exception 'invalid subject accepted'; end if;
  -- Five issue attempts in a ten-minute owner window; sixth is rejected.
  for i in 1..5 loop
    challenge := (lpad(i::text,8,'0') || '-1234-4234-8234-' || lpad(i::text,12,'0'))::uuid;
    if public.clique_link_start(owner_c,challenge) <> 'issued' then raise exception 'expected issue attempt %',i; end if;
  end loop;
  if public.clique_link_start(owner_c,c5) <> 'rate_limited' then raise exception 'rate limit not enforced'; end if;
end
$$;
reset role;

-- Verify active uniqueness and one-use consumption after transaction exit.
do $$
begin
  if (select count(*) from public.clique_account_links where revoked_at is null) <> 1 then
    raise exception 'wrong active account link count';
  end if;
  if (select count(*) from public.clique_link_challenges where consumed_at is not null) < 2 then
    raise exception 'challenge consumption missing';
  end if;
end
$$;
