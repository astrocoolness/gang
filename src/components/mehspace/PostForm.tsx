'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { addPostAction, type MehState } from '@/app/mehspace/actions';
import { inputCls } from '@/components/homies/fields';
import { uploadMedia } from './upload';
import Status from './Status';

export default function PostForm({ spaceId, userId, placeholder }: { spaceId: string; userId: string; placeholder: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<MehState>({ status: 'idle' });
  const [pending, start] = useTransition();

  // onSubmit (not action=) so React doesn't clear the form when a post fails.
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const files = fd.getAll('images').filter((f): f is File => f instanceof File && f.size > 0).slice(0, 4);
        const media = [];
        for (const f of files) media.push({ path: await uploadMedia(userId, 'posts', f, 'post'), mime: f.type, alt: '' });
        fd.delete('images');
        fd.set('media', JSON.stringify(media));
        const res = await addPostAction({ status: 'idle' }, fd);
        setState(res);
        if (res.status === 'ok') { formRef.current?.reset(); router.refresh(); }
      } catch (e) {
        setState({ status: 'error', message: e instanceof Error ? e.message : 'Upload failed.' });
      }
    });
  }
  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-2">
      <input type="hidden" name="space_id" value={spaceId} />
      <textarea name="body" rows={2} maxLength={5000} placeholder={placeholder} className={inputCls} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input type="file" name="images" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="text-xs" aria-label="Add up to 4 pictures" />
        <button disabled={pending} className="ml-auto rounded-lg bg-[var(--accent)] text-black px-4 py-1.5 font-medium">{pending ? 'Posting…' : 'Post'}</button>
      </div>
      <Status state={state} />
    </form>
  );
}
