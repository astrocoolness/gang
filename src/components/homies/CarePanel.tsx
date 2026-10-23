'use client';

import { useActionState } from 'react';
import { careAction, type FormState } from '@/app/homies/actions';

type Food = { id: string; name: string; blurb: string };

export default function CarePanel({
  homieId, isPet, canEdit, sleeping, sick, foods, cravingId,
}: { homieId: string; isPet: boolean; canEdit: boolean; sleeping: boolean; sick: boolean; foods: Food[]; cravingId?: string }) {
  const [state, act, pending] = useActionState<FormState, FormData>(careAction, { status: 'idle' });
  const c = { homieId, act, pending };
  return (
    <section className="gang-card flex flex-col gap-3" aria-label="Care">
      <h2 className="font-semibold">{canEdit ? 'Look after them' : 'Show some love'}</h2>
      {isPet ? (
        <>
          <div className="flex flex-wrap gap-2">
            {foods.map((f) => (
              <CareButton {...c} key={f.id} action="feed" food={f.id} title={f.blurb}
                label={`🍽 ${f.name}${f.id === cravingId ? ' ★' : ''}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <CareButton {...c} action="play" label="🎲 Play" />
            <CareButton {...c} action="clean" label="🧼 Clean" />
            <CareButton {...c} action="talk" label="💬 Talk" />
            {canEdit && (sleeping ? <CareButton {...c} action="wake" label="☀️ Wake" /> : <CareButton {...c} action="sleep" label="🌙 Bed" />)}
            {canEdit && sick && <CareButton {...c} action="medicine" label="💊 Medicine" />}
          </div>
          {!canEdit && <p className="text-xs text-[var(--muted)]">Friends can feed, play, clean and talk, once every 10 minutes.</p>}
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <CareButton {...c} action="talk" label="💬 Check in" />
          <CareButton {...c} action="play" label="🎲 Hang out" />
          <CareButton {...c} action="feed" label="🍩 Bring snacks" />
        </div>
      )}
      <p aria-live="polite" className={`text-sm min-h-5 ${state.status === 'error' ? 'text-[#ff5c7c]' : 'text-[var(--fg)]'}`}>
        {pending ? '…' : state.message}
      </p>
    </section>
  );
}

function CareButton({ homieId, act, pending, action, food, label, title }: {
  homieId: string; act: (fd: FormData) => void; pending: boolean; action: string; food?: string; label: string; title?: string;
}) {
  return (
    <form action={act}>
      <input type="hidden" name="id" value={homieId} />
      <input type="hidden" name="action" value={action} />
      {food && <input type="hidden" name="food" value={food} />}
      <button disabled={pending} title={title}
        className="rounded-lg border border-[#2a2a38] px-3 py-2 text-sm hover:border-[var(--accent)] disabled:opacity-40">{label}</button>
    </form>
  );
}
