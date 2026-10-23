import Link from 'next/link';
import { requireUser } from '../guard';
import ClaimForm from '@/components/homies/ClaimForm';

export const metadata = { title: 'Claim a Homie · Clique' };

export default async function ClaimPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  await requireUser(`/homies/claim${code ? `?code=${encodeURIComponent(code)}` : ''}`);
  return (
    <main className="max-w-md mx-auto px-4 py-12 flex flex-col gap-4 pb-24">
      <Link href="/homies" className="text-sm text-[var(--muted)]">← Homies</Link>
      <h1 className="text-3xl font-bold">Claim your page</h1>
      <p className="text-sm text-[var(--muted)]">A friend made a Homie of you. Enter their code to make it yours. You&apos;ll be able to edit it, and you two become friends.</p>
      <ClaimForm code={code} />
    </main>
  );
}
