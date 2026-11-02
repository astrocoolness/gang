import Link from 'next/link';
import { getUser } from '@/lib/supabase/server';
import { linkDb } from '@/lib/clique-link/service';
import LinkControls from './LinkControls';

export const dynamic = 'force-dynamic';
export default async function AppsPage() {
  const db=linkDb();
  const user=await getUser();
  let linked=false;
  let storageError=false;
  if (db && user) {
    const {data,error}=await db.from('clique_account_links').select('id').eq('owner_id',user.id)
      .eq('app_key','homies').is('revoked_at',null).limit(1).maybeSingle();
    linked=!!data; storageError=!!error;
  }
  return <main className="max-w-2xl mx-auto px-4 py-12 space-y-6">
    <h1 className="text-4xl font-bold">Connected apps</h1>
    <p className="text-sm text-[var(--muted)]">Manage which external accounts can connect to your CLIQUE identity. Only you can authorize a connection.</p>
    {!db?<div className="gang-card text-amber-300">Secure app linking is not enabled on this deployment. No accounts have been connected by this page.</div>:
      !user?<div className="gang-card"><p>Sign in before connecting HOMIES.</p><Link className="text-[var(--accent)]" href="/auth/login">Sign in to CLIQUE</Link></div>:
        storageError?<div className="gang-card text-red-400">Link storage is unavailable. No changes have been made.</div>:
          <LinkControls linked={linked}/>}
    <Link href="/" className="inline-flex text-[var(--accent)]">Return to CLIQUE</Link>
  </main>;
}
