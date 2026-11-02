import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validCompleteRequest, secureSecretMatch, isTrustedOrigin, validatedHttpsOrigin } from '../src/lib/clique-link/policy.ts';

const read = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8');
const challenge = 'd4f37f0a-778a-4c2b-997a-6a3558b915b0';
test('validates one-time UUID challenges and external subject', () => {
  assert.equal(validCompleteRequest({challenge,externalSubject:'user_abcdef123'}),true);
  for (const body of [null,{},[],{challenge:'invalid',externalSubject:'user_abc'},
    {challenge,externalSubject:'a'},{challenge,externalSubject:'other@example.test/../../'},
    {challenge,externalSubject:{id:'user_abc'}}]) {
    assert.equal(validCompleteRequest(body),false);
  }
});
test('constant-time secret comparison returns false for missing, incorrect, and short secrets',()=>{
  const secret='this-is-at-least-32-characters-long-secret';
  assert.equal(secureSecretMatch(secret,secret),true);
  assert.equal(secureSecretMatch(secret+'x',secret),false);
  assert.equal(secureSecretMatch(null,secret),false);
  assert.equal(secureSecretMatch(secret,'short'),false);
});
test('blocks open redirects, fake origins, spoofed subdomains and HTTP',()=>{
  const origins='https://rva.guru,https://gang-henna-seven.vercel.app';
  assert.equal(isTrustedOrigin('https://rva.guru',origins),true);
  for(const raw of ['http://rva.guru','https://evil.rva.guru','https://rva.guru.evil.test','https://rva.guru/a',null]) {
    assert.equal(isTrustedOrigin(raw,origins),false);
  }
  assert.equal(validatedHttpsOrigin('https://homies1.vercel.app'),'https://homies1.vercel.app');
  assert.equal(validatedHttpsOrigin('http://homies1.vercel.app'),null);
  assert.equal(validatedHttpsOrigin('https://homies1.vercel.app/path'),null);
});
test('privileged linking is off unless owner authorizes migration and secret config',()=>{
  const service=read('src/lib/clique-link/service.ts');
  assert.match(service,/CLIQUE_ACCOUNT_LINKING_ENABLED === 'true'/);
  assert.match(service,/persistSession: false/);
  assert.match(service,/CLIQUE_LINK_SERVICE_ROLE_KEY/);
  assert.match(service,/clique_link_start/);
  assert.match(service,/clique_link_complete/);
  const complete=read('src/app/api/apps/homies/link/complete/route.ts');
  assert.match(complete,/secureSecretMatch/);
  assert.match(complete,/validCompleteRequest/);
  assert.match(complete,/no-store/);
  assert.doesNotMatch(complete,/getUser\(\)/);
  const start=read('src/app/api/apps/homies/link/start/route.ts');
  assert.match(start,/getUser\(\)/);
  assert.match(start,/isTrustedOrigin/);
});
test('migration uses RLS, invoker RPC privileges, atomic locking, unique active subject',()=>{
  const sql=read('migrations/20261102_clique_account_linking.sql');
  for(const name of ['clique_link_challenges','clique_account_links']) {
    assert.ok(sql.includes('alter table public.'+name+' enable row level security'));
  }
  assert.match(sql,/revoke all on public\.clique_link_challenges, public\.clique_account_links/);
  assert.match(sql,/security invoker/);
  assert.doesNotMatch(sql,/security definer/i);
  assert.match(sql,/for update/);
  assert.match(sql,/consumed_at is null/);
  assert.match(sql,/where revoked_at is null/);
  assert.match(sql,/grant execute on function public\.clique_link_complete\(uuid, text\) to service_role/);
  assert.match(sql,/revoke all on function public\.clique_link_complete\(uuid, text\) from public, anon, authenticated/);
  assert.match(sql,/expires_at > created_at/);
});
test('App page presents consent and disabled behavior; not a social publisher',()=>{
  const page=read('src/app/apps/page.tsx');
  const controls=read('src/app/apps/LinkControls.tsx');
  assert.match(page,/getUser/);
  assert.match(controls,/does not publish your characters/);
  assert.match(controls,/revoke/);
  assert.doesNotMatch(controls,/secret|service_role/i);
});
