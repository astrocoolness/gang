import { notFound } from 'next/navigation';
import { findCircleSpace } from '@/lib/clique/mehspace';
import SpacePage from '@/components/mehspace/SpacePage';
import { requireUser } from '../../guard';

export default async function CircleMehspace({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,40}$/i.test(slug)) notFound();
  await requireUser(`/mehspace/circle/${slug}`);
  const v = await findCircleSpace(slug);
  if (!v) notFound();
  return <SpacePage v={v} />;
}
