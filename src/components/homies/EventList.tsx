import type { HomieDetail } from '@/lib/clique/homies';

const CARE: Record<string, string> = {
  feed: 'fed them', play: 'played', clean: 'cleaned up', talk: 'talked', sleep: 'put them to bed', wake: 'woke them', medicine: 'gave medicine',
};

export function eventLine(e: HomieDetail['events'][number], me: string) {
  const who = !e.actor_id ? 'Someone' : e.actor_id === me ? 'You' : e.actor?.display_name || (e.actor ? `@${e.actor.username}` : 'A friend');
  const p = e.payload ?? {};
  switch (e.type) {
    case 'created': return `${who} made this Homie.`;
    case 'imported': return 'Brought over from an older app.';
    case 'care': return `${who} ${CARE[String(p.action)] ?? 'cared'}.`;
    case 'evolve': return typeof p.line === 'string' && p.line ? p.line : `Grew into ${String(p.to)}.`;
    case 'claimed': return `${who} claimed this page.`;
    default: return `${who}: ${e.type}`;
  }
}

export default function EventList({ events, me }: { events: HomieDetail['events']; me: string }) {
  if (!events.length) return <p className="text-sm text-[var(--muted)]">Nothing yet.</p>;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {events.map((e) => (
        <li key={e.id} className="flex justify-between gap-3">
          <span>{eventLine(e, me)}</span>
          <time className="text-xs text-[var(--muted)] shrink-0" dateTime={e.created_at}>
            {new Date(e.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}
          </time>
        </li>
      ))}
    </ul>
  );
}
