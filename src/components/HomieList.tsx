'use client';

import Link from 'next/link';
import { useGang } from '@/lib/store';

/** Picker used by /mehspace and /dial index routes. */
export default function HomieList({ base, title }: { base: string; title: string }) {
  const { homies, ready } = useGang();
  return (
    <main className="max-w-xl mx-auto px-4 py-12 flex flex-col gap-4">
      <Link href="/" className="text-sm text-[var(--muted)]">← Home</Link>
      <h1 className="text-3xl font-bold">{title}</h1>
      {ready && homies.length === 0 && (
        <p className="text-[var(--muted)]">No Homies yet. <Link href="/homies" className="text-[var(--accent)]">Make one first.</Link></p>
      )}
      {homies.map((h) => (
        <Link key={h.id} href={`${base}/${h.id}`} className="gang-card flex items-center gap-3 hover:border-[var(--accent)]">
          <span className="text-2xl">{h.face_url}</span>
          <span className="flex-1">{h.name}</span>
          <span className="text-xs text-[var(--muted)]">{h.attention === 0 ? 'muted' : `${h.attention}/100`}</span>
        </Link>
      ))}
    </main>
  );
}
