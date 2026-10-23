'use client';

import { useActionState } from 'react';
import { issueClaimAction, type FormState } from '@/app/homies/actions';

export default function ClaimPanel({ homieId, name, siteUrl, highlight }: { homieId: string; name: string; siteUrl: string; highlight?: boolean }) {
  const [state, act, pending] = useActionState<FormState, FormData>(issueClaimAction, { status: 'idle' });
  const link = state.code ? `${siteUrl.replace(/\/$/, '')}/clique/homies/claim?code=${encodeURIComponent(state.code)}` : '';
  return (
    <section className={`gang-card flex flex-col gap-3 ${highlight ? 'border-[var(--accent)]' : ''}`}>
      <h2 className="font-semibold">Give this page to {name}</h2>
      <p className="text-sm text-[var(--muted)]">
        Generate a one-time claim code and send it to them. When they claim it, the page becomes theirs to edit and you become friends.
        A new code replaces the old one.
      </p>
      <form action={act}>
        <input type="hidden" name="id" value={homieId} />
        <button disabled={pending} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm disabled:opacity-50">
          {state.code ? 'Generate a new code' : 'Generate claim code'}
        </button>
      </form>
      {state.status === 'error' && <p className="text-sm text-[#ff5c7c]">{state.message}</p>}
      {state.code && (
        <div className="flex flex-col gap-1 text-sm">
          <p>Code: <code className="text-lg tracking-widest select-all">{state.code}</code></p>
          <p className="break-all">Link: <span className="select-all text-[var(--accent)]">{link}</span></p>
          <p className="text-xs text-[var(--muted)]">{state.message} We only store a hash, so copy it now.</p>
        </div>
      )}
    </section>
  );
}
