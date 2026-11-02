/**
 * Private, fail-closed config gate. Do not return this report from a public
 * endpoint: it exposes operational readiness and could aid reconnaissance.
 * Preview/production ownership and SSO must still be verified independently.
 */
export type LinkRuntimeConfig = Record<string, string | undefined>;
export type LinkReadiness = { ready: boolean; missing: readonly string[] };

const AUTH_ORIGIN = /^https:\/\/[a-z0-9.-]+(?::\d{2,5})?$/i;
function httpsOrigin(raw: string | undefined): boolean {
  if (!raw || !AUTH_ORIGIN.test(raw)) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.origin === raw && !url.username &&
      !url.password && url.pathname === '/' && !url.search && !url.hash;
  } catch { return false; }
}
export function assessLinkReadiness(env: LinkRuntimeConfig): LinkReadiness {
  const missing: string[] = [];
  if (env.CLIQUE_ACCOUNT_LINKING_ENABLED !== 'true') missing.push('feature_disabled');
  if (!httpsOrigin(env.NEXT_PUBLIC_SUPABASE_URL)) missing.push('supabase_url');
  if ((env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim().length < 16) missing.push('supabase_public_key');
  if ((env.CLIQUE_LINK_SERVICE_ROLE_KEY || '').trim().length < 32) missing.push('supabase_private_key');
  if ((env.CLIQUE_LINK_SECRET || '').trim().length < 32) missing.push('shared_secret');
  if (env.CLIQUE_LINK_SERVICE_ROLE_KEY &&
      env.CLIQUE_LINK_SECRET === env.CLIQUE_LINK_SERVICE_ROLE_KEY) missing.push('secret_reuse');
  if (!httpsOrigin(env.CLIQUE_HOMIES_LINK_ORIGIN)) missing.push('homies_origin');
  if (!httpsOrigin(env.CLIQUE_PUBLIC_RETURN_ORIGIN) ||
      !['https://rva.guru','https://www.rva.guru'].includes(env.CLIQUE_PUBLIC_RETURN_ORIGIN || '')) {
    missing.push('return_origin');
  }
  const entries = (env.CLIQUE_LINK_ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
  if (!entries.length || entries.length > 10 || new Set(entries).size !== entries.length ||
      !entries.every(httpsOrigin) || !entries.includes(env.CLIQUE_PUBLIC_RETURN_ORIGIN || '')) {
    missing.push('browser_origin_allowlist');
  }
  return { ready: missing.length === 0, missing };
}
