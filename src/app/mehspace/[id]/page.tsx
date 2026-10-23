import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseConfigured } from '@/lib/supabase/env';
import { findUserSpace, USERNAME_RE } from '@/lib/clique/mehspace';
import LocalSpace from '@/components/mehspace/LocalSpace';
import SpacePage from '@/components/mehspace/SpacePage';
import { requireUser } from '../guard';

/** /mehspace/{username} is a person's cloud Mehspace; anything else is a device (gang:v1) Homie id. */
export default async function MehspaceById({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = decodeURIComponent(id).toLowerCase();
  if (!USERNAME_RE.test(key)) return <LocalSpace id={id} />;
  if (!supabaseConfigured) notFound();
  await requireUser(`/mehspace/${key}`);
  const res = await findUserSpace(key);
  if (res.status === 'ok') return <SpacePage v={res.view} />;
  return (
    <main className="max-w-xl mx-auto px-4 py-12 flex flex-col gap-4">
      <Link href="/mehspace" className="text-sm text-[var(--muted)]">← Mehspace</Link>
      <p className="gang-card">
        {res.status === 'hidden' ? `${res.profile.display_name || `@${res.profile.username}`}'s Mehspace is friends-only.` : 'No Mehspace here.'}
      </p>
    </main>
  );
}
