# HOMIES to CLIQUE secure account linking (draft)

Disabled by default. This is not a deployed connection. The GANG Next.js zone uses basePath '/clique'. Its receiver path is /clique/api/apps/homies/link/complete, not /api/clique/apps/homies/link/complete. HOMIES needs the coordinated sender path fix.

## End-to-end flow

1. Signed-in Clique owner visits /clique/apps and presses Link HOMIES. Start POST verifies browser Origin against CLIQUE_LINK_ALLOWED_ORIGINS, calls Supabase getUser() and a service-only database function. Challenge creation is transaction-locked and limited to five per ten minutes per owner.
2. Ten-minute UUID challenge belongs to that Clique owner. Redirect is built from fixed configured HTTPS CLIQUE_HOMIES_LINK_ORIGIN, with a fixed return URL back to rva.guru/clique/apps.
3. HOMIES confirms the signed-in real account and sends the subject server-to-server with x-clique-link-secret. Development fallback identities remain blocked. The browser never receives the secret.
4. Receiver compares the shared secret using constant-time digests, validates the challenge and body, then calls single-transaction clique_link_complete. It locks the challenge, enforces expiry and one-time use, prevents cross-owner hijack and duplicate active identities, and records consumption only after successful link.
5. /clique/apps reads only the owner connection status. Revocation uses owner-session + same-origin POST to revoke active link and pending challenges.

## Security and operational prerequisites

- The migration migrations/20261102_clique_account_linking.sql has NOT been applied by CI, Vercel, or this PR. Review with DB owner, back up data, test on preview, verify privilege/RLS checks, then request production approval.
- Both tables have RLS enabled, no browser grants. Functions are SECURITY INVOKER, with execution revoked from public, anon and authenticated; service_role alone gets execute. The privileged key stays exclusively server-side, never in NEXT_PUBLIC variables.
- Required GANG server variables: CLIQUE_ACCOUNT_LINKING_ENABLED=true, CLIQUE_LINK_SERVICE_ROLE_KEY, CLIQUE_LINK_SECRET (minimum 32 characters, same as HOMIES server), CLIQUE_LINK_ALLOWED_ORIGINS, CLIQUE_HOMIES_LINK_ORIGIN, CLIQUE_PUBLIC_RETURN_ORIGIN.
- HOMIES requires CLIQUE_API_ORIGIN, CLIQUE_LINK_SECRET. Do NOT enable while the GANG endpoint is protected by SSO or the Homies deployment is mislinked. Verify canonical cross-zone sessions from rva.guru.
- Account linking does not automatically publish any characters, media, posts or messages. Sharing requires separate opt-in, idempotent delivery, permissions and moderation.
- Further steps: distributed service rate limits on completion, expired challenge cleanup, audit alerts, secret rotation and full E2E with two independent accounts and concurrent link attempts.

## Rollback

Disable CLIQUE_ACCOUNT_LINKING_ENABLED. Rotate/revoke shared secrets if compromised. Preserve or revoke existing mapping only with the user's consent; dropping data tables would be destructive and needs separate approval.
