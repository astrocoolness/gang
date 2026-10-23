import Link from 'next/link';
import HomieList from '@/components/HomieList';
import { supabaseConfigured } from '@/lib/supabase/env';
import { listSpaces } from '@/lib/clique/mehspace';

export const metadata = { title: 'Mehspace · Clique' };

export default async function MehspaceIndex() {
  if (!supabaseConfigured) return <HomieList base="/mehspace" title="Mehspace" />;
  const data = await listSpaces();
  if (!data) {
    return (
      <main className="max-w-xl mx-auto px-4 py-12 flex flex-col gap-4">
        <Link href="/" className="text-sm text-[var(--muted)]">← Home</Link>
        <h1 className="text-3xl font-bold">Mehspace</h1>
        <p className="gang-card text-sm">
          <Link href="/auth/login?next=/mehspace" className="text-[var(--accent)]">Sign in</Link> to make your Mehspace and see your friends’ pages.
        </p>
        <Link href="/mehspace/device" className="text-sm text-[var(--muted)]">Mehspaces saved on this device →</Link>
      </main>
    );
  }
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-4 pb-24">
      <Link href="/" className="text-sm text-[var(--muted)]">← Home</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold flex-1">Mehspace</h1>
        {data.hasProfile && <Link href="/mehspace/edit" className="rounded-lg bg-[var(--accent)] text-black px-3 py-1.5 text-sm font-medium">Edit my Mehspace</Link>}
      </div>
      {!data.hasProfile && (
        <p className="gang-card text-sm"><Link href="/onboarding?next=/mehspace" className="text-[var(--accent)]">Set up your profile</Link> to get your Mehspace.</p>
      )}
      {data.cards.length === 0 && <p className="text-sm text-[var(--muted)]">No pages to show yet.</p>}
      <ul className="flex flex-col gap-2">
        {data.cards.map((c) => (
          <li key={c.id}>
            <Link href={c.href} className="gang-card flex items-center gap-3 hover:border-[var(--accent)]">
              <span className="text-2xl">{c.face}</span>
              <span className="flex-1 min-w-0">
                <span className="block truncate">{c.title}</span>
                <span className="block text-xs text-[var(--muted)]">{c.label}{c.mine ? ' · yours' : ''}{c.mood ? ` · ${c.mood}` : ''}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/mehspace/device" className="text-sm text-[var(--muted)]">Mehspaces saved on this device →</Link>
    </main>
  );
}
