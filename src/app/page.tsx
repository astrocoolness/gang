import Link from 'next/link';
import { supabaseConfigured } from '@/lib/supabase/env';
import { getHomeFeed } from '@/lib/clique/homies';
import { activityHref, activityLine } from '@/lib/clique/feed';

export default async function Home() {
  const feed = supabaseConfigured ? await getHomeFeed().catch(() => null) : null;
  return (
    <main className="max-w-4xl mx-auto px-4 py-12 flex flex-col gap-8 pb-24">
      <h1 className="text-5xl font-bold tracking-tight">Clique</h1>
      <p className="text-lg text-[var(--muted)] max-w-md">
        Make your Homie. Tend their Mehspace. Dial when it matters.
      </p>
      {feed ? (
        <section className="gang-card flex flex-col gap-2" aria-label="Activity">
          <h2 className="font-semibold">What&apos;s happening</h2>
          {feed.activities.length === 0 && (
            <p className="text-sm text-[var(--muted)]">Quiet so far. <Link href="/homies/new" className="text-[var(--accent)]">Make a Homie</Link> or invite friends.</p>
          )}
          <ul className="flex flex-col gap-1 text-sm">
            {feed.activities.map((a) => { const href = activityHref(a); return (
              <li key={a.id} className="flex justify-between gap-3">
                {href ? (
                  <Link href={href} className="hover:text-[var(--accent)]">{activityLine(a, feed.userId, feed.people)}</Link>
                ) : (
                  <span>{activityLine(a, feed.userId, feed.people)}</span>
                )}
                <time className="text-xs text-[var(--muted)] shrink-0" dateTime={a.created_at}>
                  {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}
                </time>
              </li>
            ); })}
          </ul>
        </section>
      ) : (
        <div className="gang-card text-sm text-[var(--muted)]">
          Your feed of friend, Circle and Homie activity will show up here
          {supabaseConfigured ? <> once you <Link href="/auth/login?next=/" className="text-[var(--accent)]">sign in</Link>.</> : '.'}
        </div>
      )}
      <div className="flex flex-wrap gap-4">
        <Link href="/homies" className="gang-card hover:border-[var(--accent)] transition">Homies</Link>
        <Link href="/mehspace" className="gang-card hover:border-[var(--accent)] transition">Mehspace</Link>
        <Link href="/dial" className="gang-card hover:border-[var(--accent)] transition dial-ring">Dial</Link>
        <Link href="/circles" className="gang-card hover:border-[var(--accent)] transition">Circles</Link>
        <Link href="/onboarding" className="gang-card hover:border-[var(--accent)] transition">Your profile</Link>
      </div>
    </main>
  );
}
