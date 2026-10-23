import Link from 'next/link';
import { requireUser } from '../guard';
import { listInfluences } from '@/lib/clique/homies';
import InfluenceForm from '@/components/homies/InfluenceForm';
import { deleteInfluenceAction } from '../actions';

export const metadata = { title: 'Influence library · Clique' };

export default async function LibraryPage() {
  await requireUser('/homies/library');
  const lib = await listInfluences();
  const rows = lib?.influences ?? [];
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-6 pb-24">
      <Link href="/homies" className="text-sm text-[var(--muted)]">← Homies</Link>
      <h1 className="text-3xl font-bold">Influence library</h1>
      <p className="text-sm text-[var(--muted)]">The music, books, films, places and people that shape your Homies. Private unless you share them; attach them from a Homie&apos;s page.</p>
      <section className="gang-card"><InfluenceForm /></section>
      <section className="flex flex-col gap-2">
        {rows.length === 0 && <p className="text-sm text-[var(--muted)]">Your library is empty.</p>}
        {rows.map((i) => (
          <div key={i.id} className="gang-card flex items-start gap-3">
            <span className="text-xs px-2 py-0.5 rounded-full border border-[#2a2a38]">{i.kind}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium">
                {i.url ? <a href={i.url} target="_blank" rel="noopener noreferrer nofollow" className="text-[var(--accent)]">{i.title}</a> : i.title}
              </p>
              {i.notes && <p className="text-sm text-[var(--muted)]">{i.notes}</p>}
              <p className="text-xs text-[var(--muted)]">
                {i.visibility}{i.tags.length ? ` · ${i.tags.join(', ')}` : ''} · on {lib?.uses[i.id] ?? 0} Homie{(lib?.uses[i.id] ?? 0) === 1 ? '' : 's'}
              </p>
            </div>
            <form action={deleteInfluenceAction}>
              <input type="hidden" name="id" value={i.id} />
              <button className="text-xs text-[var(--muted)] hover:text-[#ff5c7c]">Delete</button>
            </form>
          </div>
        ))}
      </section>
    </main>
  );
}
