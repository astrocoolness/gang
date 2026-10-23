import { notFound } from 'next/navigation';
import { findHomieSpace } from '@/lib/clique/mehspace';
import SpacePage from '@/components/mehspace/SpacePage';
import { requireUser } from '../../guard';

export default async function HomieMehspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  await requireUser(`/mehspace/homie/${id}`);
  const v = await findHomieSpace(id);
  if (!v) notFound();
  return <SpacePage v={v} />;
}
