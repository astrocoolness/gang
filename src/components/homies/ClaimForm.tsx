'use client';

import { useActionState } from 'react';
import { claimAction, type FormState } from '@/app/homies/actions';
import { inputCls } from './fields';

export default function ClaimForm({ code }: { code?: string }) {
  const [state, act, pending] = useActionState<FormState, FormData>(claimAction, { status: 'idle' });
  return (
    <form action={act} className="gang-card flex flex-col gap-3">
      <input name="code" defaultValue={code} required maxLength={64} autoComplete="off" placeholder="Claim code" className={`${inputCls} tracking-widest`} />
      {state.status === 'error' && <p className="text-sm text-[#ff5c7c]" role="alert">{state.message}</p>}
      <button disabled={pending} className="self-start rounded-lg bg-[var(--accent)] px-5 py-2 disabled:opacity-50">Claim it</button>
    </form>
  );
}
