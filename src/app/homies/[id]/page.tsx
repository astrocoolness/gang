import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { requireUser } from '../guard';
import { loadHomie } from '@/lib/clique/homies';
import { asset } from '@/lib/homies/asset';
import HomieAvatar, { KIND_LABEL } from '@/components/homies/HomieAvatar';
import CarePanel from '@/components/homies/CarePanel';
import ClaimPanel from '@/components/homies/ClaimPanel';
import StatBars from '@/components/homies/StatBars';
import EventList from '@/components/homies/EventList';
import InfluenceForm from '@/components/homies/InfluenceForm';
import { attachInfluenceAction, deleteHomieAction, detachInfluenceAction } from '../actions';

export default async function HomiePage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ share?: string; error?: string }>;
}) {
  const { id } = await params;
  const { share, error } = await searchParams;
  await requireUser(`/homies/${id}`);
  const d = await loadHomie(id);
  if (!d) notFound();
  const { homie: h, pet } = d;
  const person = (p: typeof d.owner) => (p ? p.display_name || `@${p.username}` : 'a friend');
  const h2 = await headers();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${h2.get('x-forwarded-proto') ?? 'https'}://${h2.get('host')}`;
  const attachable = d.myInfluences.filter((i) => !d.influences.some((l) => l.influence.id === i.id));

  return (
    <main className="max-w-4xl mx-auto px-4 py-12 flex flex-col gap-6 pb-24">
      <Link href="/homies" className="text-sm text-[var(--muted)]">← Homies</Link>
      {error && <p className="text-sm text-[#ff5c7c]" role="alert">{error}</p>}

      <header className="flex flex-wrap items-center gap-4">
        <HomieAvatar homie={h} portrait={pet?.portrait} size={96} />
        <div className="flex-1 min-w-0">
          <h1 className="text-4xl font-bold truncate">{h.name}</h1>
          <p className="text-sm text-[var(--muted)]">
            {KIND_LABEL[h.kind]}
            {pet && ` · ${pet.stageLabel} · day ${pet.lifeDay} · ${pet.clock}`}
            {!d.isOwner && ` · made by ${person(d.owner)}`}
            {h.claimed_by && (h.claimed_by === d.userId ? ' · this is you' : ` · claimed by ${person(d.claimer)}`)}
            {` · ${h.visibility}`}
          </p>
        </div>
        {d.canEdit && (
          <div className="flex gap-2 text-sm">
            <Link href={`/homies/${h.id}/edit`} className="rounded-lg border border-[#2a2a38] px-3 py-1.5 hover:border-[var(--accent)]">Edit</Link>
            {pet && <Link href={`/homies/${h.id}/story`} className="rounded-lg border border-[#2a2a38] px-3 py-1.5 hover:border-[var(--accent)]">Story</Link>}
          </div>
        )}
      </header>

      {pet && (
        <section className="gang-card flex flex-col gap-4 sm:flex-row">
          {pet.room && (
            <Image src={asset(pet.room)} alt="" width={240} height={160} className="rounded-lg object-cover w-full sm:w-60 h-40" />
          )}
          <div className="flex-1 flex flex-col gap-3">
            <p className="text-lg">{pet.status}</p>
            <p className="text-xs text-[var(--muted)]">
              {pet.sleeping ? 'Asleep. ' : ''}{pet.sick ? 'Feeling sick. ' : ''}{pet.working ? 'At work. ' : ''}
              Craving: {pet.craving.name}. {pet.traitPhrases.join(' ')}
            </p>
            <StatBars stats={pet.stats} />
          </div>
        </section>
      )}

      {(h.backstory || h.interests.length > 0) && (
        <section className="gang-card flex flex-col gap-2">
          {h.backstory && <p className="whitespace-pre-wrap">{h.backstory}</p>}
          {h.interests.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {h.interests.map((i) => <span key={i} className="text-xs px-2 py-0.5 rounded-full border border-[#2a2a38]">{i}</span>)}
            </div>
          )}
        </section>
      )}

      <CarePanel homieId={h.id} isPet={!!pet} canEdit={d.canEdit} sleeping={!!pet?.sleeping} sick={!!pet?.sick}
        foods={pet?.foods.map((f) => ({ id: f.id, name: f.name, blurb: f.blurb })) ?? []} cravingId={pet?.craving.id} />

      {h.kind === 'friend_page' && d.isOwner && !h.claimed_by && (
        <ClaimPanel homieId={h.id} name={h.name} siteUrl={siteUrl} highlight={share === '1'} />
      )}

      {pet && pet.log.length > 0 && (
        <section className="gang-card flex flex-col gap-2">
          <h2 className="font-semibold">Lately</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {pet.log.slice(0, 6).map((l) => <li key={l.id} className={l.kind === 'milestone' ? 'text-[var(--accent)]' : ''}>{l.text}</li>)}
          </ul>
        </section>
      )}

      <section className="gang-card flex flex-col gap-3">
        <h2 className="font-semibold">Influences</h2>
        {d.influences.length === 0 && <p className="text-sm text-[var(--muted)]">No influences yet{d.canEdit ? ': attach music, books, places or people that shape this Homie.' : '.'}</p>}
        <ul className="flex flex-col gap-2">
          {d.influences.map(({ influence: i, weight }) => (
            <li key={i.id} className="flex items-center gap-3 text-sm">
              <span className="text-xs px-2 py-0.5 rounded-full border border-[#2a2a38]">{i.kind}</span>
              {i.url ? <a href={i.url} target="_blank" rel="noopener noreferrer nofollow" className="text-[var(--accent)]">{i.title}</a> : <span>{i.title}</span>}
              <span className="text-xs text-[var(--muted)]">weight {weight.toFixed(1)}</span>
              {d.canEdit && (
                <form action={detachInfluenceAction} className="ml-auto">
                  <input type="hidden" name="homie_id" value={h.id} /><input type="hidden" name="influence_id" value={i.id} />
                  <button className="text-xs text-[var(--muted)] hover:text-[#ff5c7c]">Remove</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {d.canEdit && attachable.length > 0 && (
          <form action={attachInfluenceAction} className="flex flex-wrap items-center gap-2 text-sm">
            <input type="hidden" name="homie_id" value={h.id} />
            <select name="influence_id" className="bg-[#0f0f16] border border-[#2a2a38] rounded-lg px-3 py-2">
              {attachable.map((i) => <option key={i.id} value={i.id}>{i.title} ({i.kind})</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">weight
              <input name="weight" type="range" min="0" max="1" step="0.1" defaultValue="0.5" />
            </label>
            <button className="rounded-lg border border-[#2a2a38] px-3 py-2 hover:border-[var(--accent)]">Attach</button>
          </form>
        )}
        {d.canEdit && (
          <details>
            <summary className="text-sm text-[var(--muted)] cursor-pointer">New influence</summary>
            <div className="mt-3"><InfluenceForm homieId={h.id} /></div>
          </details>
        )}
        {d.canEdit && <Link href="/homies/library" className="text-xs text-[var(--muted)]">Manage your library →</Link>}
      </section>

      <section className="gang-card flex flex-col gap-2">
        <h2 className="font-semibold">Activity</h2>
        <EventList events={d.events} me={d.userId} />
      </section>

      {d.isOwner && (
        <form action={deleteHomieAction} className="self-start">
          <input type="hidden" name="id" value={h.id} />
          <button className="text-sm text-[var(--muted)] hover:text-[#ff5c7c]">Delete this Homie</button>
        </form>
      )}
    </main>
  );
}
