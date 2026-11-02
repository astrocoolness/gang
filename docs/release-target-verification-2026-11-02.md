# CLIQUE / HOMIES account connection: verified release target audit

**2026-11-02 — read-only environment inspection. No deployment or database mutation performed.**

| Check | Evidence | Decision |
|---|---|---|
| GANG Git source | Vercel project `gang` points at `astrocoolness/gang` | Correct source |
| GANG runtime configuration | 0 project environment variables reported | **BLOCKED**: neither real Supabase browser auth nor CLIQUE server-only connection secret is configured |
| GANG origin | Only attached project domain `gang-henna-seven.vercel.app`; project deployment protection is configured as `all_except_custom_domains` | **BLOCKED**: the only linked hostname is not an unprotected custom origin for the multi-zone /clique rewrite |
| HOMIES project | Vercel project named `homies` points at the **RVA core** repository; latest inspected deployment ERROR | **BLOCKED**: wrong Git source; cannot repair via the currently exposed Vercel update-project parameters |
| Correct HOMIES alternative | Vercel project `crap-homies-` points at `astrocoolness/homies`, has `homies1.vercel.app` alias, latest inspected deployment READY; SSO protection set to `all_except_custom_domains` | Correct source but **not evidence of public authentication or completed linking** |
| RVA core production Supabase public URL | Vercel production `NEXT_PUBLIC_SUPABASE_URL` references Supabase project ref `oesdpdcncwdjnfvludxx` | Target is **not available** in the three connected Supabase account project listings; this URL alone does not authorize us to use it for CLIQUE |
| Connected Supabase projects | Connected active projects inspected: `nixvobtunxvtgnidogwa`, `vnxjxyyzvocnmmvvjncn`; neither has tables in `public` at time inspected | Neither can be assumed to be the canonical shared-identity project |
| Staged database migration | GitHub draft #8 contains `migrations/20261102_clique_account_linking.sql`; CI applies it **only to disposable PostgreSQL** | Keep unapplied to user projects |
| Security and HTTP test gate | CI includes contract tests, SQL role/expiry/revoke tests and disabled-mode HTTP smoke | Passing CI is necessary, not equivalent to authenticated real-user E2E |

## Release dependency chain

1. **Identify the database owner and environment.** Confirm which project actually backs RVA's shared account system. Require explicit project ref, backup plan, and isolated preview, not a convenient but unrelated active Supabase project.
2. **Repair the Vercel source/domain architecture.** Reconnect the mislinked Homies project in authorized Vercel settings (or deliberately choose the existing correctly linked alternative), verify branch/commit and rollback. Establish an approved unprotected **custom-domain** GANG origin or documented auth-aware proxy; do not turn off deployment protection globally just to make a rewrite pass.
3. **Approve an isolated preview database migration and secrets.** Configure GANG NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, CLIQUE_LINK_SERVICE_ROLE_KEY, CLIQUE_LINK_SECRET, allowlisted origins, and the feature flag via Vercel's secret management. The private service key must never go in NEXT_PUBLIC variables. Configure matching server-side secret on HOMIES separately.
4. **Verify login and cross-zone sessions.** Full magic-link login must work on canonical and alternate custom-domain origin. Confirm CSRF/cookie scopes and same-origin request behavior.
5. **Verify end-to-end app linking with real test identities in preview.** Test owner A and owner B, duplicate Homies subject conflict, expired and consumed challenges, revocation, concurrent completion attempts, rate limiting, error/success UX, and that no unapproved media or character data transfers.
6. **Approval before production.** Review commit SHAs, CI and preview evidence, backing up the exact target database, rollback plan, and affected Vercel project IDs. Release feature flag disabled first; enable only after post-release monitoring and approval.

## Fail-closed behavior

GANG draft #8 now has a runtime readiness validator and a real HTTP smoke test for disabled mode, so missing configuration cannot result in an accidental successful link response. Both projects' runtime link feature must remain disabled until all dependencies above are verified. A GitHub READY check or a Vercel deployment marked READY is **not** evidence that the public auth flow works.

No owner secrets, account IDs, token values, data exports or private user rows appear in this audit.
