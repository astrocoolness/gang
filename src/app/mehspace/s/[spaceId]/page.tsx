import { notFound, redirect } from 'next/navigation';
import { spaceUrl } from '@/lib/clique/mehspace';
import { requireUser } from '../../guard';

/** Stable link by space id (Home feed) → canonical /mehspace/{username|homie/id|circle/slug}. */
export default async function SpaceById({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(spaceId)) notFound();
  await requireUser(`/mehspace/s/${spaceId}`);
  const url = await spaceUrl(spaceId);
  if (!url) notFound();
  redirect(url);
}
