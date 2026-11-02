import test from 'node:test';
import assert from 'node:assert/strict';
import { assessLinkReadiness } from '../src/lib/clique-link/readiness.ts';

const ready = {
  CLIQUE_ACCOUNT_LINKING_ENABLED: 'true',
  NEXT_PUBLIC_SUPABASE_URL: 'https://db-sandbox.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test_public_key_1234',
  CLIQUE_LINK_SERVICE_ROLE_KEY: 'sb_secret_example_longer_than_32_characters',
  CLIQUE_LINK_SECRET: 'independent-example-shared-secret-is-32-bytes',
  CLIQUE_HOMIES_LINK_ORIGIN: 'https://homies1.vercel.app',
  CLIQUE_PUBLIC_RETURN_ORIGIN: 'https://rva.guru',
  CLIQUE_LINK_ALLOWED_ORIGINS: 'https://rva.guru,https://www.rva.guru',
};
test('never enables without approved flag and every necessary auth/secret field',()=>{
  assert.deepEqual(assessLinkReadiness(ready),{ready:true,missing:[]});
  assert.deepEqual(assessLinkReadiness({}),{ready:false,missing:[
    'feature_disabled','supabase_url','supabase_public_key','supabase_private_key',
    'shared_secret','homies_origin','return_origin','browser_origin_allowlist',
  ]});
  for(const key of Object.keys(ready)) {
    const changed={...ready,[key]:''};
    assert.equal(assessLinkReadiness(changed).ready,false,'missing '+key+' must block activation');
  }
});
test('rejects spoofed/wrong schemes, open redirects and secret reuse',()=>{
  for(const bad of ['http://homies1.vercel.app','https://homies1.vercel.app.evil.test',
    'https://homies1.vercel.app/redirect','https://user:pass@homies1.vercel.app']) {
    assert.ok(assessLinkReadiness({...ready,CLIQUE_HOMIES_LINK_ORIGIN:bad}).missing.includes('homies_origin'));
  }
  assert.ok(assessLinkReadiness({...ready,CLIQUE_PUBLIC_RETURN_ORIGIN:'https://evil.test'}).missing.includes('return_origin'));
  assert.ok(assessLinkReadiness({...ready,CLIQUE_LINK_SECRET:ready.CLIQUE_LINK_SERVICE_ROLE_KEY}).missing.includes('secret_reuse'));
  assert.ok(assessLinkReadiness({...ready,CLIQUE_LINK_ALLOWED_ORIGINS:'https://evil.test'}).missing.includes('browser_origin_allowlist'));
  assert.ok(assessLinkReadiness({...ready,NEXT_PUBLIC_SUPABASE_URL:'http://db-sandbox.supabase.co'}).missing.includes('supabase_url'));
  assert.ok(assessLinkReadiness({...ready,CLIQUE_ACCOUNT_LINKING_ENABLED:'false'}).missing.includes('feature_disabled'));
});
test('does not expose runtime secret contents in readiness results',()=>{
  const report=assessLinkReadiness({...ready,CLIQUE_LINK_SECRET:'super-secret'});
  assert.equal(report.ready,false);
  assert.ok(report.missing.includes('shared_secret'));
  assert.ok(!JSON.stringify(report).includes('super-secret'));
});
