import { redirect } from 'next/navigation';
import { mySpaceId } from '@/lib/clique/mehspace';
import { requireUser } from '../guard';

export default async function EditMine() {
  await requireUser('/mehspace/edit');
  const id = await mySpaceId();
  redirect(id ? `/mehspace/edit/${id}` : '/onboarding?next=/mehspace/edit');
}
