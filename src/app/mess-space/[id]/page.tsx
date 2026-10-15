'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useParams } from 'next/navigation';
import { newPost, useGang } from '@/lib/store';
import { refillAttention } from '@/lib/dial';
import AttentionBar from '@/components/AttentionBar';

const ME = 'local-visitor';

export default function MessSpacePage() {
  const { id } = useParams<{ id: string }>();
  const { homies, spaces, ready, setAttention, updateSpace } = useGang();
  const homie = homies.find((h) => h.id === id);
  const space = spaces.find((s) => s.homie_id === id);
  const [body, setBody] = useState('');

  if (!ready) return null;
  if (!homie || !space) {
    return <main className="p-12 text-center">Homie not found. <Link href="/homies" className="text-[var(--accent)]">Back to Homies</Link></main>;
  }

  const columns = (space.layout_json.columns as number) ?? 1;

  function comment(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    updateSpace(id, (m) => ({ ...m, posts: [newPost(ME, body.trim()), ...m.posts] }));
    setAttention(id, (a) => refillAttention(a, 'comment'));
    setBody('');
  }

  function toggleLike(postId: string) {
    const post = space!.posts.find((p) => p.id === postId);
    const liked = post?.likes.includes(ME);
    updateSpace(id, (m) => ({
      ...m,
      posts: m.posts.map((p) => (p.id === postId ? { ...p, likes: liked ? p.likes.filter((l) => l !== ME) : [...p.likes, ME] } : p)),
    }));
    if (!liked) setAttention(id, (a) => refillAttention(a, 'like'));
  }

  function toggleLayout() {
    updateSpace(id, (m) => ({ ...m, layout_json: { ...m.layout_json, columns: columns === 1 ? 2 : 1 } }));
    setAttention(id, (a) => refillAttention(a, 'layout'));
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-6">
      <Link href="/mess-space" className="text-sm text-[var(--muted)]">← Mess Space</Link>
      <header className="gang-card flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span className="text-6xl">{homie.face_url}</span>
          <div>
            <h1 className="text-3xl font-bold">{homie.name}</h1>
            <p className="text-sm text-[var(--muted)]">{homie.backstory}</p>
          </div>
        </div>
        <AttentionBar value={homie.attention} />
        <div className="flex gap-2 text-sm">
          <button onClick={toggleLayout} className="rounded-lg border border-[#2a2a38] px-3 py-1.5 hover:border-[var(--accent)]">
            Switch to {columns === 1 ? '2-column' : '1-column'} layout (+5)
          </button>
          <Link href={`/dial/${homie.id}`} className="rounded-lg bg-[var(--accent)] px-3 py-1.5">Dial {homie.name}</Link>
        </div>
      </header>

      <form onSubmit={comment} className="flex gap-2">
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Leave something for ${homie.name} (+8)`}
          className="flex-1 bg-[#0f0f16] border border-[#2a2a38] rounded-lg px-3 py-2" />
        <button className="rounded-lg bg-[var(--accent)] px-4">Post</button>
      </form>

      <section className={`grid gap-3 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
        {space.posts.length === 0 && <p className="text-[var(--muted)]">Nothing here yet. Care shows.</p>}
        {space.posts.map((p) => (
          <article key={p.id} className="gang-card flex flex-col gap-2">
            <p>{p.body}</p>
            <div className="flex justify-between text-xs text-[var(--muted)]">
              <time>{new Date(p.created_at).toLocaleString()}</time>
              <button onClick={() => toggleLike(p.id)} className={p.likes.includes(ME) ? 'text-[var(--accent)]' : ''}>
                ♥ {p.likes.length}
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
