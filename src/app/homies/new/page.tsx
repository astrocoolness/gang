import Link from 'next/link';
import { requireUser } from '../guard';
import { listHomiesOverview } from '@/lib/clique/homies';
import CreateHomieForm from '@/components/homies/CreateHomieForm';
import type { HomieKind } from '@/lib/clique/types';

export const metadata = { title: 'New Homie · Clique' };

export default async function NewHomiePage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  await requireUser(`/homies/new${kind ? `?kind=${kind}` : ''}`);
  const o = await listHomiesOverview();
  const initial: HomieKind = kind === 'avatar' || kind === 'friend_page' ? kind : 'pet';
  return (
    <main className="max-w-4xl mx-auto px-4 py-12 flex flex-col gap-6 pb-24">
      <Link href="/homies" className="text-sm text-[var(--muted)]">← Homies</Link>
      <h1 className="text-4xl font-bold">New Homie</h1>
      <CreateHomieForm initialKind={initial} hasAvatar={!!o?.hasAvatar} />
    </main>
  );
}
