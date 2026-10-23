import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '../../guard';
import { loadHomie } from '@/lib/clique/homies';
import EditHomieForm from '@/components/homies/EditHomieForm';

export default async function EditHomiePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/homies/${id}/edit`);
  const d = await loadHomie(id);
  if (!d) notFound();
  if (!d.canEdit) redirect(`/homies/${id}`);
  return (
    <main className="max-w-2xl mx-auto px-4 py-12 flex flex-col gap-6 pb-24">
      <Link href={`/homies/${id}`} className="text-sm text-[var(--muted)]">← {d.homie.name}</Link>
      <h1 className="text-3xl font-bold">Edit {d.homie.name}</h1>
      <EditHomieForm homie={d.homie} />
    </main>
  );
}
