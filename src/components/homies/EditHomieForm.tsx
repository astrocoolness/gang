'use client';

import { useActionState } from 'react';
import { updateHomieAction, type FormState } from '@/app/homies/actions';
import type { CliqueHomie } from '@/lib/clique/types';
import { FacePicker, FieldError, inputCls, VisibilitySelect } from './fields';

export default function EditHomieForm({ homie }: { homie: CliqueHomie }) {
  const [state, act, pending] = useActionState<FormState, FormData>(updateHomieAction, { status: 'idle' });
  const e = state.errors ?? {};
  const pet = homie.kind === 'pet';
  return (
    <form action={act} className="gang-card flex flex-col gap-4">
      <input type="hidden" name="id" value={homie.id} />
      <input type="hidden" name="kind" value={homie.kind} />
      {pet ? (
        <input type="hidden" name="name" value={homie.name} />
      ) : (
        <label className="text-sm text-[var(--muted)] flex flex-col gap-2">Name
          <input name="name" defaultValue={homie.name} required maxLength={40} className={inputCls} />
          <FieldError msg={e.name} />
        </label>
      )}
      {pet ? <input type="hidden" name="face" value={homie.face} /> : <FacePicker defaultFace={homie.face} />}
      <label className="text-sm text-[var(--muted)] flex flex-col gap-2">{homie.kind === 'friend_page' ? 'About them' : 'Backstory'}
        <textarea name="backstory" defaultValue={homie.backstory} rows={4} maxLength={2000} className={inputCls} />
        <FieldError msg={e.backstory} />
      </label>
      <label className="text-sm text-[var(--muted)] flex flex-col gap-2">Interests
        <input name="interests" defaultValue={homie.interests.join(', ')} className={inputCls} />
      </label>
      <VisibilitySelect defaultValue={homie.visibility} />
      {pet && <p className="text-xs text-[var(--muted)]">A pet&apos;s name and look are set at hatching.</p>}
      {state.status === 'error' && <p className="text-sm text-[#ff5c7c]" role="alert">{state.message}</p>}
      <button disabled={pending} className="self-start rounded-lg bg-[var(--accent)] px-5 py-2 disabled:opacity-50">Save</button>
    </form>
  );
}
