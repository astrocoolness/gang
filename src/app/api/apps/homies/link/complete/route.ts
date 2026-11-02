import { linkDb, finishChallenge } from '@/lib/clique-link/service';
import { DISABLED_RESPONSE, secureSecretMatch, validCompleteRequest } from '@/lib/clique-link/policy';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  const db = linkDb();
  if (!db) return Response.json(DISABLED_RESPONSE, { status: 503, headers });
  if (!secureSecretMatch(request.headers.get('x-clique-link-secret'), process.env.CLIQUE_LINK_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  }
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    return Response.json({ error: 'invalid_content_type' }, { status: 415, headers });
  }
  const text = await request.text();
  if (text.length > 2048) return Response.json({ error: 'invalid_request' }, { status: 400, headers });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return Response.json({ error: 'invalid_request' }, { status: 400, headers }); }
  if (!validCompleteRequest(body)) return Response.json({ error: 'invalid_request' }, { status: 400, headers });
  const result = await finishChallenge(db, body.challenge, body.externalSubject);
  if ('error' in result) return Response.json({ error: result.error }, {
    status: result.error === 'link_conflict' ? 409 :
      result.error === 'invalid_or_expired_challenge' ? 410 : 503,
    headers,
  });
  return Response.json({ result: { status: result.status } }, { headers });
}
