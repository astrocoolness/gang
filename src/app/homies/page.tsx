import Link from 'next/link';
import { supabaseConfigured } from '@/lib/supabase/env';
import { listHomiesOverview } from '@/lib/clique/homies';
import LocalHomies from '@/components/homies/LocalHomies';
import HomieTile from '@/components/homies/HomieTile';

export const metadata = { title: 'Homies · Clique' };

export default async function HomiesPage() {
  // No Supabase env: the original gang:v1 device-only Homies.
  if (!supabaseConfigured) return <LocalHomies />;
  const o = await listHomiesOverview();
  if (!o) {
    return (
      <LocalHomies
        notice={
          <p className="gang-card text-sm text-[var(--muted)]">
            These live on this device only. <Link href="/auth/login?next=/homies" className="text-[var(--accent)]">Sign in</Link> to
            raise pets, make an avatar, build pages for friends and let them care.
          </p>
        }
      />
    );
  }
  const name = (id: string | null) => (id && o.people[id] ? o.people[id].display_name || `@${o.people[id].username}` : 'a friend');
  return (
    <main className="max-w-4xl mx-auto px-4 py-12 flex flex-col gap-8 pb-24">
      <Link href="/" className="text-sm text-[var(--muted)]">← Home</Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-bold">Homies</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/homies/library" className="rounded-lg border border-[#2a2a38] px-3 py-1.5 hover:border-[var(--accent)]">Influence library</Link>
          <Link href="/homies/claim" className="rounded-lg border border-[#2a2a38] px-3 py-1.5 hover:border-[var(--accent)]">Have a claim code?</Link>
          <Link href="/homies/device" className="rounded-lg border border-[#2a2a38] px-3 py-1.5 hover:border-[var(--accent)]">Device Homies</Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {!o.hasAvatar && (
          <Link href="/homies/new?kind=avatar" className="gang-card hover:border-[var(--accent)]">
            <p className="font-semibold">+ Your avatar</p><p className="text-xs text-[var(--muted)]">The Homie that is you.</p>
          </Link>
        )}
        <Link href="/homies/new?kind=pet" className="gang-card hover:border-[var(--accent)]">
          <p className="font-semibold">+ Raise a pet</p><p className="text-xs text-[var(--muted)]">Tony, Betty, Nori, or your own.</p>
        </Link>
        <Link href="/homies/new?kind=friend_page" className="gang-card hover:border-[var(--accent)]">
          <p className="font-semibold">+ Page for a friend</p><p className="text-xs text-[var(--muted)]">Then send them a claim code.</p>
        </Link>
      </section>

      <Section title="Yours" empty="Nothing yet. Start with an avatar or a pet.">
        {o.mine.map((h) => <HomieTile key={h.id} homie={h} />)}
      </Section>
      {o.claimed.length > 0 && (
        <Section title="Pages friends made of you">
          {o.claimed.map((h) => <HomieTile key={h.id} homie={h} note={`made by ${name(h.owner_id)}`} />)}
        </Section>
      )}
      {o.made.length > 0 && (
        <Section title="Pages you made (claimed)">
          {o.made.map((h) => <HomieTile key={h.id} homie={h} note={`claimed by ${name(h.claimed_by)}`} />)}
        </Section>
      )}
      <Section title="Friends' Homies" empty="When friends make Homies you can see, they show up here. You can care for them.">
        {o.others.map((h) => <HomieTile key={h.id} homie={h} note={`${name(h.owner_id)}'s`} />)}
      </Section>
    </main>
  );
}

function Section({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children.length === 0 ? <p className="text-sm text-[var(--muted)]">{empty}</p> : <div className="grid gap-3 sm:grid-cols-2">{children}</div>}
    </section>
  );
}
