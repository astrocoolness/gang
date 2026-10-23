'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  attachInfluence, careFor, claimByCode, createHomieRow, createInfluence, deleteHomieRow, deleteInfluence,
  detachInfluence, INFLUENCE_KINDS, issueClaim, updateHomieFields,
} from '@/lib/clique/homies';
import { parseCreate, parseFields, parseInterests, type Errors } from '@/lib/homies/validate';
import { isAction } from '@/lib/homies/sim';
import type { CliqueInfluence, Privacy } from '@/lib/clique/types';

export type FormState = { status: 'idle' | 'ok' | 'error'; message?: string; errors?: Errors; code?: string };
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v.trim() : '';
};
const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export async function createHomieAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { input, errors } = parseCreate(fd);
  if (Object.keys(errors).length) return { status: 'error', errors, message: 'Fix the highlighted fields.' };
  const res = await createHomieRow(input);
  if (!res.ok) return { status: 'error', message: res.error };
  revalidatePath('/homies');
  revalidatePath('/');
  redirect(`/homies/${res.data.id}${input.kind === 'friend_page' ? '?share=1' : ''}`);
}

export async function updateHomieAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, 'id');
  if (!isId(id)) return { status: 'error', message: 'Missing Homie.' };
  const { fields, errors } = parseFields(fd);
  if (str(fd, 'kind') === 'pet') delete errors.name;
  if (Object.keys(errors).length) return { status: 'error', errors, message: 'Fix the highlighted fields.' };
  const res = await updateHomieFields(id, fields);
  if (!res.ok) return { status: 'error', message: res.error };
  revalidatePath(`/homies/${id}`);
  revalidatePath('/homies');
  redirect(`/homies/${id}`);
}

export async function deleteHomieAction(fd: FormData) {
  const id = str(fd, 'id');
  if (!isId(id)) return;
  const res = await deleteHomieRow(id);
  if (!res.ok) redirect(`/homies/${id}?error=${encodeURIComponent(res.error)}`);
  revalidatePath('/homies');
  redirect('/homies');
}

export async function careAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, 'id');
  const action = str(fd, 'action');
  if (!isId(id) || !isAction(action)) return { status: 'error', message: 'Unknown care action.' };
  const res = await careFor(id, action, str(fd, 'food') || undefined);
  if (!res.ok) return { status: 'error', message: res.error };
  revalidatePath(`/homies/${id}`);
  return { status: 'ok', message: res.data.text };
}

export async function issueClaimAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, 'id');
  if (!isId(id)) return { status: 'error', message: 'Missing Homie.' };
  const res = await issueClaim(id);
  if (!res.ok) return { status: 'error', message: res.error };
  return { status: 'ok', code: res.data, message: 'Send this to your friend. It works once and expires in 14 days.' };
}

export async function claimAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const res = await claimByCode(str(fd, 'code'));
  if (!res.ok) return { status: 'error', message: res.error };
  revalidatePath('/homies');
  redirect(isId(res.data) ? `/homies/${res.data}` : '/homies');
}

export async function createInfluenceAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const title = str(fd, 'title').slice(0, 200);
  const kindRaw = str(fd, 'kind');
  const kind = ((INFLUENCE_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : 'other') as CliqueInfluence['kind'];
  const urlRaw = str(fd, 'url');
  const vis = str(fd, 'visibility');
  if (!title) return { status: 'error', message: 'Give it a title.' };
  if (urlRaw && !/^https?:\/\/\S+$/i.test(urlRaw)) return { status: 'error', message: 'Links must start with http:// or https://' };
  const res = await createInfluence({
    title, kind, url: urlRaw || null, notes: str(fd, 'notes').slice(0, 2000), tags: parseInterests(str(fd, 'tags')),
    visibility: (['public', 'friends', 'private'].includes(vis) ? vis : 'private') as Privacy,
  });
  if (!res.ok) return { status: 'error', message: res.error };
  const homieId = str(fd, 'homie_id');
  if (isId(homieId)) {
    await attachInfluence(homieId, res.data.id, 0.5);
    revalidatePath(`/homies/${homieId}`);
  }
  revalidatePath('/homies/library');
  return { status: 'ok', message: `Added “${res.data.title}”.` };
}

export async function deleteInfluenceAction(fd: FormData) {
  const id = str(fd, 'id');
  if (isId(id)) await deleteInfluence(id);
  revalidatePath('/homies/library');
}

export async function attachInfluenceAction(fd: FormData) {
  const homieId = str(fd, 'homie_id');
  const influenceId = str(fd, 'influence_id');
  if (!isId(homieId) || !isId(influenceId)) return;
  const res = await attachInfluence(homieId, influenceId, Number(str(fd, 'weight') || '0.5'));
  if (!res.ok) redirect(`/homies/${homieId}?error=${encodeURIComponent(res.error)}`);
  revalidatePath(`/homies/${homieId}`);
}

export async function detachInfluenceAction(fd: FormData) {
  const homieId = str(fd, 'homie_id');
  const influenceId = str(fd, 'influence_id');
  if (!isId(homieId) || !isId(influenceId)) return;
  await detachInfluence(homieId, influenceId);
  revalidatePath(`/homies/${homieId}`);
}
