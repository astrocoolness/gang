import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '../../guard';
import { loadHomie } from '@/lib/clique/homies';

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/homies/${id}/story`);
  const d = await loadHomie(id);
  if (!d || !d.pet) notFound();
  return (
    <main className="max-w-2xl mx-auto px-4 py-12 flex flex-col gap-6 pb-24">
      <Link href={`/homies/${id}`} className="text-sm text-[var(--muted)]">← {d.homie.name}</Link>
      <h1 className="text-3xl font-bold">{d.homie.name}&apos;s story</h1>
      <section className="gang-card">
        <h2 className="font-semibold mb-2">Milestones</h2>
        <ol className="flex flex-col gap-1 text-sm">{d.pet.milestones.map((m) => <li key={m.id}>{m.title}</li>)}</ol>
      </section>
      <section className="gang-card">
        <h2 className="font-semibold mb-2">Recent life</h2>
        <ol className="flex flex-col gap-1 text-sm">
          {d.pet.log.map((l) => <li key={l.id} className={l.kind === 'milestone' ? 'text-[var(--accent)]' : ''}>{l.text}</li>)}
        </ol>
      </section>
    </main>
  );
}
