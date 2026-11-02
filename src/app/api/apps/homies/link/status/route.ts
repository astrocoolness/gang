import { getUser } from '@/lib/supabase/server';
import { linkDb } from '@/lib/clique-link/service';
import { DISABLED_RESPONSE } from '@/lib/clique-link/policy';

export const dynamic = 'force-dynamic';
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  const db = linkDb();
  if (!db) return Response.json(DISABLED_RESPONSE, { status: 503, headers });
  const user = await getUser();
  if (!user?.id) return Response.json({ error: 'login_required' }, { status: 401, headers });
  const { data, error } = await db.from('clique_account_links').select('created_at')
    .eq('owner_id', user.id).eq('app_key', 'homies').is('revoked_at', null).limit(1).maybeSingle();
  if (error) return Response.json({ error: 'storage_unavailable' }, { status: 503, headers });
  return Response.json({ linked: !!data, linkedAt: data?.created_at || null }, { headers });
}
