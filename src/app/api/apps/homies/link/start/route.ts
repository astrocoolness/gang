import { getUser } from '@/lib/supabase/server';
import { isTrustedOrigin, DISABLED_RESPONSE } from '@/lib/clique-link/policy';
import { linkDb, issueChallenge } from '@/lib/clique-link/service';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  if (!isTrustedOrigin(request.headers.get('origin'), process.env.CLIQUE_LINK_ALLOWED_ORIGINS)) {
    return Response.json({ error: 'invalid_origin' }, { status: 403, headers });
  }
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    return Response.json({ error: 'invalid_content_type' }, { status: 415, headers });
  }
  const db = linkDb();
  if (!db) return Response.json(DISABLED_RESPONSE, { status: 503, headers });
  const user = await getUser();
  if (!user?.id) return Response.json({ error: 'login_required' }, { status: 401, headers });
  const result = await issueChallenge(db, user.id);
  if ('error' in result) return Response.json({ error: result.error }, {
    status: result.error === 'rate_limited' ? 429 : 503, headers,
  });
  return Response.json({ linkUrl: result.url, expiresInSeconds: 600 }, { headers });
}
