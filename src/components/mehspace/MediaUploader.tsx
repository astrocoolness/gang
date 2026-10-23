'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveMediaAction } from '@/app/mehspace/actions';
import { uploadMedia } from './upload';

const ACCEPT = { photo: 'image/jpeg,image/png,image/webp,image/gif', song: 'audio/mpeg' } as const;

export default function MediaUploader({ spaceId, userId, kind, hasFile }: { spaceId: string; userId: string; kind: 'song' | 'photo'; hasFile: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const label = kind === 'photo' ? 'Profile photo' : 'Profile song (mp3)';

  function onFile(file: File | undefined) {
    if (!file) return;
    start(async () => {
      try {
        const path = await uploadMedia(userId, 'mehspace', file, kind);
        const res = await saveMediaAction(spaceId, kind, path);
        setMsg(res.message ?? null);
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Upload failed.');
      }
    });
  }
  function remove() {
    start(async () => {
      const res = await saveMediaAction(spaceId, kind, null);
      setMsg(res.message ?? null);
      router.refresh();
    });
  }
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex flex-col gap-1 text-[var(--muted)]">{label}
        <input type="file" accept={ACCEPT[kind]} disabled={pending} onChange={(e) => onFile(e.target.files?.[0])} data-testid={`upload-${kind}`} />
      </label>
      {hasFile && <button type="button" onClick={remove} disabled={pending} className="text-xs text-[var(--muted)] hover:text-[#ff5c7c]">Remove</button>}
      {pending && <span className="text-xs text-[var(--muted)]">Uploading…</span>}
      {msg && <span className="text-xs" role="status">{msg}</span>}
    </div>
  );
}
