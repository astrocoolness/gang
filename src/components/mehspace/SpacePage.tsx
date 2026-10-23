/* eslint-disable @next/next/no-img-element -- signed storage URLs, not static assets */
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { BlurbView, PersonLite, PostView, SpaceView, TopFriend } from '@/lib/clique/mehspace';
import { renderError } from '@/lib/clique/mehspace';
import { themeOf, type Theme } from '@/lib/mehspace/themes';
import { deleteBlurbAction, deletePostAction, rerenderAction, toggleLikeAction } from '@/app/mehspace/actions';
import MehspaceFrame from './MehspaceFrame';
import PostForm from './PostForm';
import BlurbForm from './BlurbForm';

const personName = (p: PersonLite | null) => (p ? p.display_name || `@${p.username}` : 'a friend');
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });

function Panel({ t, title, children }: { t: Theme; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-4 flex flex-col gap-3" style={{ background: t.panel, border: `1px solid ${t.border}` }}>
      <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: t.accent }}>{title}</h2>
      {children}
    </section>
  );
}

function TopEight({ top }: { top: TopFriend[] }) {
  return (
    <ul className="grid grid-cols-4 gap-3">
      {top.map((f) => (
        <li key={f.id} className="flex flex-col items-center gap-1 text-center text-xs">
          {f.person ? (
            <Link href={`/mehspace/${f.person.username}`} className="flex flex-col items-center gap-1 hover:underline">
              <span className="text-3xl w-14 h-14 rounded-lg flex items-center justify-center bg-black/30">{f.face}</span>
              <span className="truncate max-w-[5rem]">{personName(f.person)}</span>
            </Link>
          ) : (
            <><span className="text-3xl w-14 h-14 rounded-lg flex items-center justify-center bg-black/30">🔒</span><span>a friend</span></>
          )}
        </li>
      ))}
    </ul>
  );
}

function Post({ p, canModerate }: { p: PostView; canModerate: boolean }) {
  return (
    <article className="flex flex-col gap-2 border-t border-white/10 pt-3 first:border-0 first:pt-0">
      <p className="text-xs opacity-70">
        {p.author ? <Link href={`/mehspace/${p.author.username}`} className="hover:underline">{personName(p.author)}</Link> : 'Someone'} · {fmt(p.created_at)}
      </p>
      {p.body && <p className="whitespace-pre-wrap">{p.body}</p>}
      {p.images.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {p.images.map((m, i) => <img key={i} src={m.url} alt={m.alt} referrerPolicy="no-referrer" className="rounded-lg w-full object-cover max-h-72" />)}
        </div>
      )}
      <div className="flex items-center gap-3 text-xs">
        <form action={toggleLikeAction}>
          <input type="hidden" name="post_id" value={p.id} />
          <button aria-pressed={p.liked} className={p.liked ? 'font-bold' : 'opacity-70'}>♥ {p.likes}</button>
        </form>
        {(p.mine || canModerate) && (
          <form action={deletePostAction} className="ml-auto">
            <input type="hidden" name="post_id" value={p.id} />
            <button className="opacity-60 hover:opacity-100">Delete</button>
          </form>
        )}
      </div>
    </article>
  );
}

function Blurb({ b, canModerate }: { b: BlurbView; canModerate: boolean }) {
  return (
    <li className="flex flex-col gap-1">
      <p className="whitespace-pre-wrap">“{b.body}”</p>
      <div className="text-xs opacity-70 flex gap-2">
        <span>— {b.author ? <Link href={`/mehspace/${b.author.username}`} className="hover:underline">{personName(b.author)}</Link> : 'a friend'}, {fmt(b.created_at)}</span>
        {(b.mine || canModerate) && (
          <form action={deleteBlurbAction} className="ml-auto">
            <input type="hidden" name="blurb_id" value={b.id} />
            <button className="opacity-60 hover:opacity-100">Remove</button>
          </form>
        )}
      </div>
    </li>
  );
}

export default function SpacePage({ v }: { v: SpaceView }) {
  const t = themeOf(v.space.theme);
  const s = v.space;
  const ownerName = v.owner.kind === 'user' ? personName(v.owner.profile) : v.owner.kind === 'homie' ? v.owner.homie.name : v.owner.circle.name;
  const subtitle = v.owner.kind === 'user' ? `@${v.owner.profile.username}` : v.owner.kind === 'homie' ? 'Homie Mehspace' : 'Circle Mehspace';
  const face = v.owner.kind === 'homie' ? v.owner.homie.face : v.owner.kind === 'circle' ? '👥' : null;
  const rError = renderError(s);
  const style = { background: t.bg, color: t.ink, '--accent': t.accent } as CSSProperties;
  const hasCustom = !!(s.custom_html || s.custom_css);

  return (
    <div style={style} className="min-h-screen">
      <main className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6 pb-24">
        <nav className="flex gap-4 text-sm opacity-80">
          <Link href="/mehspace">← Mehspace</Link>
          {v.owner.kind === 'homie' && <Link href={`/homies/${v.owner.homie.id}`}>Homie page</Link>}
          {v.canEdit && <Link href={`/mehspace/edit/${s.id}`} className="ml-auto font-semibold" style={{ color: t.accent }}>Edit this Mehspace</Link>}
        </nav>

        <header className="rounded-xl p-5 flex flex-wrap items-center gap-5" style={{ background: t.panel, border: `1px solid ${t.border}` }}>
          {v.photoUrl ? (
            <img src={v.photoUrl} alt={ownerName} referrerPolicy="no-referrer" className="w-28 h-28 rounded-lg object-cover" />
          ) : (
            <span className="w-28 h-28 rounded-lg flex items-center justify-center text-6xl bg-black/30">{face ?? '🙂'}</span>
          )}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <h1 className="text-3xl font-bold truncate">{s.title || ownerName}</h1>
            <p className="text-sm opacity-80">{subtitle} · {s.visibility === 'public' ? 'everyone' : s.visibility === 'friends' ? 'friends' : 'only editors'}</p>
            {s.mood && <p className="text-sm"><span className="opacity-70">Mood:</span> {s.mood}</p>}
            {v.songUrl && (
              v.songIsUpload
                ? <audio controls preload="none" src={v.songUrl} className="mt-2 max-w-full" aria-label="Profile song" />
                : <a href={v.songUrl} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-sm underline" style={{ color: t.accent }}>▶ Profile song</a>
            )}
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-[1fr_1.6fr]">
          <div className="flex flex-col gap-6">
            {(s.about || s.interests.length > 0 || s.heroes.length > 0) && (
              <Panel t={t} title={`About ${ownerName}`}>
                {s.about && <p className="whitespace-pre-wrap text-sm">{s.about}</p>}
                {s.interests.length > 0 && <p className="text-sm"><span className="opacity-70">Interests:</span> {s.interests.join(', ')}</p>}
                {s.heroes.length > 0 && <p className="text-sm"><span className="opacity-70">Heroes:</span> {s.heroes.join(', ')}</p>}
              </Panel>
            )}
            <Panel t={t} title={`${ownerName}'s Top ${v.top.length || 8}`}>
              {v.top.length ? <TopEight top={v.top} /> : <p className="text-sm opacity-70">No Top 8 yet.</p>}
            </Panel>
            <Panel t={t} title="Blurbs">
              {v.canBlurb && <BlurbForm spaceId={s.id} name={ownerName} />}
              {v.blurbs.length === 0 && <p className="text-sm opacity-70">No blurbs yet. Friends write these.</p>}
              <ul className="flex flex-col gap-3 text-sm">{v.blurbs.map((b) => <Blurb key={b.id} b={b} canModerate={v.canEdit} />)}</ul>
            </Panel>
          </div>

          <div className="flex flex-col gap-6">
            {v.frameDoc ? (
              <MehspaceFrame doc={v.frameDoc} height={v.frameHeight} title={`${ownerName}'s custom Mehspace`} />
            ) : hasCustom && v.canEdit ? (
              <Panel t={t} title="Custom section">
                <p className="text-sm opacity-80">
                  {s.render_status === 'rejected' ? `Not published: ${rError ?? 'the sanitizer rejected it.'}` : 'Saved, waiting to publish.'}
                </p>
                <form action={rerenderAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="text-sm underline">Try publishing again</button>
                </form>
              </Panel>
            ) : null}
            <Panel t={t} title="Posts">
              <PostForm spaceId={s.id} userId={v.userId} placeholder={v.canEdit ? 'Post something' : `Leave something for ${ownerName}`} />
              {v.posts.length === 0 && <p className="text-sm opacity-70">Nothing here yet.</p>}
              <div className="flex flex-col gap-3">{v.posts.map((p) => <Post key={p.id} p={p} canModerate={v.canEdit} />)}</div>
            </Panel>
          </div>
        </div>
      </main>
    </div>
  );
}
