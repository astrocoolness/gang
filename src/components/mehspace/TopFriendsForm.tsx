'use client';

import { useActionState, useState } from 'react';
import { saveTopAction, type MehState } from '@/app/mehspace/actions';
import Status from './Status';

type Friend = { id: string; username: string; display_name: string };

export default function TopFriendsForm({ spaceId, friends, initial }: { spaceId: string; friends: Friend[]; initial: string[] }) {
  const [state, action, pending] = useActionState<MehState, FormData>(saveTopAction, { status: 'idle' });
  const [picked, setPicked] = useState<string[]>(initial.filter((id) => friends.some((f) => f.id === id)));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 8 ? p : [...p, id]));
  const name = (f: Friend) => f.display_name || `@${f.username}`;
  if (!friends.length) return <p className="text-sm text-[var(--muted)]">Add friends first; Top 8 is friends only.</p>;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={spaceId} />
      {picked.map((id) => <input key={id} type="hidden" name="top" value={id} />)}
      <p className="text-xs text-[var(--muted)]">Pick up to 8, in order. {picked.length}/8</p>
      <ol className="flex flex-wrap gap-2 text-sm">
        {picked.map((id, i) => {
          const f = friends.find((x) => x.id === id)!;
          return <li key={id} className="px-2 py-1 rounded-full border border-[var(--accent)]">{i + 1}. {name(f)}</li>;
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        {friends.map((f) => (
          <button type="button" key={f.id} onClick={() => toggle(f.id)} aria-pressed={picked.includes(f.id)}
            className={`text-sm px-3 py-1.5 rounded-lg border ${picked.includes(f.id) ? 'border-[var(--accent)]' : 'border-[#2a2a38]'}`}>{name(f)}</button>
        ))}
      </div>
      <Status state={state} />
      <button disabled={pending} className="self-start rounded-lg bg-[var(--accent)] text-black px-4 py-2 font-medium">{pending ? 'Saving…' : 'Save Top 8'}</button>
    </form>
  );
}
