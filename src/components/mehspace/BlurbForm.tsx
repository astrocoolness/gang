'use client';

import { startTransition, useActionState, useRef } from 'react';
import { addBlurbAction, type MehState } from '@/app/mehspace/actions';
import { inputCls } from '@/components/homies/fields';
import Status from './Status';

export default function BlurbForm({ spaceId, name }: { spaceId: string; name: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<MehState, FormData>(async (prev, fd) => {
    const res = await addBlurbAction(prev, fd);
    if (res.status === 'ok') formRef.current?.reset();
    return res;
  }, { status: 'idle' });
  // onSubmit rather than action= so a rejected blurb keeps its text; we clear it ourselves on success.
  return (
    <form ref={formRef} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="flex flex-col gap-2">
      <input type="hidden" name="space_id" value={spaceId} />
      <textarea name="body" rows={2} maxLength={1000} placeholder={`Write a blurb about ${name}`} className={inputCls} />
      <Status state={state} />
      <button disabled={pending} className="self-start rounded-lg border border-[var(--accent)] px-4 py-1.5 text-sm">{pending ? 'Adding…' : 'Add blurb'}</button>
    </form>
  );
}
