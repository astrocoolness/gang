'use client';

import { startTransition, useActionState } from 'react';
import { saveBasicsAction, type MehState } from '@/app/mehspace/actions';
import { MOODS, THEMES, THEME_IDS } from '@/lib/mehspace/themes';
import { inputCls } from '@/components/homies/fields';
import { VISIBILITY_OPTIONS } from '@/lib/homies/constants';
import Status from './Status';

export interface BasicsValues {
  id: string; title: string; mood: string; about: string; interests: string[]; heroes: string[];
  theme: string; visibility: string; song_url: string | null; frame_height: number;
}

export default function BasicsForm({ v, isUser }: { v: BasicsValues; isUser: boolean }) {
  const [state, action, pending] = useActionState<MehState, FormData>(saveBasicsAction, { status: 'idle' });
  return (
    // onSubmit rather than action= so a rejected save keeps what was typed (React resets action forms).
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={v.id} />
      <label className="text-sm text-[var(--muted)] flex flex-col gap-2">Title
        <input name="title" defaultValue={v.title} maxLength={80} className={inputCls} />
      </label>
      <label className="text-sm text-[var(--muted)] flex flex-col gap-2">Mood
        <input name="mood" defaultValue={v.mood} maxLength={60} list="mehspace-moods" placeholder="😎 chillin" className={inputCls} />
        <datalist id="mehspace-moods">{MOODS.map((m) => <option key={m} value={m} />)}</datalist>
      </label>
      <label className="text-sm text-[var(--muted)] flex flex-col gap-2">About
        <textarea name="about" defaultValue={v.about} maxLength={5000} rows={4} className={inputCls} />
      </label>
      <label className="text-sm text-[var(--muted)] flex flex-col gap-2">Interests (comma-separated)
        <input name="interests" defaultValue={v.interests.join(', ')} className={inputCls} />
      </label>
      <label className="text-sm text-[var(--muted)] flex flex-col gap-2">Heroes (comma-separated)
        <input name="heroes" defaultValue={v.heroes.join(', ')} className={inputCls} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-[var(--muted)] flex flex-col gap-2">Theme
          <select name="theme" defaultValue={v.theme} className={inputCls}>
            {THEME_IDS.map((t) => <option key={t} value={t}>{THEMES[t].label}</option>)}
          </select>
        </label>
        <label className="text-sm text-[var(--muted)] flex flex-col gap-2">Who can see it
          <select name="visibility" defaultValue={v.visibility} className={inputCls}>
            {VISIBILITY_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          {isUser && <span className="text-xs">Can’t be more public than your profile privacy.</span>}
        </label>
      </div>
      <label className="text-sm text-[var(--muted)] flex flex-col gap-2">Song link (https, optional; an uploaded mp3 wins)
        <input name="song_url" type="url" defaultValue={v.song_url ?? ''} placeholder="https://…" className={inputCls} />
      </label>
      <label className="text-sm text-[var(--muted)] flex flex-col gap-2">Custom section height (px)
        <input name="frame_height" type="number" min={200} max={3000} step={10} defaultValue={v.frame_height} className={inputCls} />
      </label>
      <Status state={state} />
      <button disabled={pending} className="self-start rounded-lg bg-[var(--accent)] text-black px-4 py-2 font-medium">{pending ? 'Saving…' : 'Save basics'}</button>
    </form>
  );
}
