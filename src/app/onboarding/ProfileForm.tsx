'use client';

import { useActionState } from 'react';
import { saveProfileAction, type ProfileFormState } from './actions';
import type { ProfileInput } from '@/lib/clique/validate';

const field = 'bg-[#0f0f16] border border-[#2a2a38] rounded-lg px-3 py-2 w-full';

export default function ProfileForm({ initial, isNew }: { initial: ProfileInput; isNew: boolean }) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(saveProfileAction, { status: 'idle' });
  const v = state.values ?? initial;
  const err = state.errors ?? {};
  return (
    <form action={action} className="gang-card flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Username
        <div className="flex items-center gap-1"><span className="text-[var(--muted)]">@</span>
          <input name="username" defaultValue={v.username} required maxLength={24} className={field} autoComplete="username" />
        </div>
        {err.username && <span className="text-red-400">{err.username}</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Display name
        <input name="display_name" defaultValue={v.display_name} required maxLength={60} className={field} />
        {err.display_name && <span className="text-red-400">{err.display_name}</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Status
        <input name="status" defaultValue={v.status} maxLength={80} placeholder="vibing" className={field} />
        {err.status && <span className="text-red-400">{err.status}</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Bio
        <textarea name="bio" defaultValue={v.bio} maxLength={500} rows={3} className={field} />
        {err.bio && <span className="text-red-400">{err.bio}</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Who can see your profile and Mehspace
        <select name="privacy" defaultValue={v.privacy} className={field}>
          <option value="friends">Friends only</option>
          <option value="public">Anyone signed in to Clique</option>
          <option value="private">Only me</option>
        </select>
      </label>
      {state.message && (
        <p className={`text-sm ${state.status === 'saved' ? 'text-green-400' : 'text-red-400'}`}>{state.message}</p>
      )}
      <button disabled={pending} className="rounded-lg bg-[var(--accent)] py-2 disabled:opacity-60">
        {pending ? 'Saving…' : isNew ? 'Create my profile' : 'Save changes'}
      </button>
    </form>
  );
}
