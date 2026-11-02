'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useGang } from '@/lib/store';
import { buildLocalFeed, type FeedSort } from '@/lib/feed';

export default function FeedPage() {
  const { homies, spaces, ready }=useGang();
  const [search,setSearch]=useState('');
  const [sort,setSort]=useState<FeedSort>('recent');
  const items=useMemo(()=>buildLocalFeed(homies,spaces,{search,sort}),[homies,spaces,search,sort]);
  return <main className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-6">
    <div>
      <p className="text-xs tracking-[.2em] uppercase text-[var(--accent)]">CLIQUE / SOCIAL</p>
      <h1 className="mt-2 text-4xl font-bold">The Local Feed</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">Recent posts from your Homies' Mehspaces, on this device only. Nothing here has been shared or synced with other accounts yet.</p>
    </div>
    <div className="gang-card flex flex-col sm:flex-row gap-3">
      <label className="flex-1 text-sm">Search posts
        <input value={search} onChange={e=>setSearch(e.target.value)} maxLength={80} placeholder="Search characters, music, stories…" className="mt-1 w-full rounded-lg border border-[#33384a] bg-[#0c0d16] p-3"/>
      </label>
      <label className="text-sm">Sort
        <select value={sort} onChange={e=>setSort(e.target.value as FeedSort)} className="mt-1 w-full sm:w-40 rounded-lg border border-[#33384a] bg-[#0c0d16] p-3">
          <option value="recent">Newest</option><option value="popular">Most liked</option>
        </select>
      </label>
    </div>
    {!ready?<p role="status" className="text-[var(--muted)]">Loading local posts…</p>
      :items.length===0?<div className="gang-card"><p className="text-lg font-medium">{search?'No matching posts yet.':'Your feed is ready for its first post.'}</p><p className="text-sm text-[var(--muted)] mt-2">Create a Homie, open their Mehspace, and leave a post. It will appear here immediately.</p><Link className="inline-block mt-4 rounded-lg px-4 py-2 bg-[var(--accent)]" href="/homies">Explore Homies</Link></div>
      :<section aria-label="Local activity posts" className="grid gap-3">{items.map(post=>
        <article key={post.spaceId+':'+post.id} className="gang-card flex flex-col gap-3">
          <div className="flex items-center gap-3"><span aria-hidden="true" className="text-3xl">{post.face}</span><div><Link href={`/mehspace/${post.homieId}`} className="font-semibold hover:underline">{post.homieName}</Link><p className="text-xs text-[var(--muted)]">{post.author} · <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString()}</time></p></div></div>
          <p className="break-words whitespace-pre-wrap leading-relaxed">{post.body}</p>
          <div className="flex items-center justify-between text-sm text-[var(--muted)]"><span>♥ {post.likes} likes</span><Link href={`/mehspace/${post.homieId}`} className="text-[var(--accent)] hover:underline">Open Mehspace</Link></div>
        </article>)}</section>}
  </main>;
}
