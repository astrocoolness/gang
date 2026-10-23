'use client';

import { useActionState } from 'react';
import { createInfluenceAction, type FormState } from '@/app/homies/actions';
import { inputCls } from './fields';

const KINDS = ['music', 'book', 'film', 'art', 'place', 'person', 'url', 'other'];

export default function InfluenceForm({ homieId }: { homieId?: string }) {
  const [state, act, pending] = useActionState<FormState, FormData>(createInfluenceAction, { status: 'idle' });
  return (
    <form action={act} className="flex flex-col gap-3">
      {homieId && <input type="hidden" name="homie_id" value={homieId} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input name="title" required maxLength={200} placeholder="Title (a song, a book, a place, a person…)" className={inputCls} />
        <select name="kind" defaultValue="music" className={inputCls}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
      </div>
      <input name="url" type="url" placeholder="https://… (optional)" className={inputCls} />
      <textarea name="notes" rows={2} maxLength={2000} placeholder="Why it matters (optional)" className={inputCls} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input name="tags" placeholder="Tags, comma separated" className={inputCls} />
        <select name="visibility" defaultValue="private" className={inputCls}>
          <option value="private">Only me</option><option value="friends">Friends</option><option value="public">Everyone</option>
        </select>
      </div>
      <button disabled={pending} className="self-start rounded-lg bg-[var(--accent)] px-4 py-2 text-sm disabled:opacity-50">
        {homieId ? 'Add and attach' : 'Add to library'}
      </button>
      {state.message && <p className={`text-sm ${state.status === 'error' ? 'text-[#ff5c7c]' : 'text-green-400'}`}>{state.message}</p>}
    </form>
  );
}
