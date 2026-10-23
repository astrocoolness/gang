import Link from 'next/link';
import type { CliqueHomie } from '@/lib/clique/types';
import HomieAvatar, { KIND_LABEL, portraitFor } from './HomieAvatar';

export default function HomieTile({ homie, note }: { homie: CliqueHomie; note?: string }) {
  const stats = homie.stats ?? {};
  const mood = typeof stats.happiness === 'number' ? Math.round(stats.happiness) : null;
  return (
    <Link href={`/homies/${homie.id}`} className="gang-card flex items-center gap-3 hover:border-[var(--accent)] transition">
      <HomieAvatar homie={homie} portrait={portraitFor(homie)} />
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold truncate">{homie.name}</h3>
        <p className="text-xs text-[var(--muted)]">
          {KIND_LABEL[homie.kind]}{homie.kind === 'pet' ? ` · ${homie.stage}` : ''}{mood != null ? ` · mood ${mood}` : ''}
        </p>
        {note && <p className="text-xs text-[var(--muted)] truncate">{note}</p>}
      </div>
    </Link>
  );
}
