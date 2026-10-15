import Link from 'next/link';
import { Homie } from '@/types';
import AttentionBar from './AttentionBar';

export default function HomieCard({ homie, onDelete }: { homie: Homie; onDelete?: () => void }) {
  return (
    <div className="gang-card flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="text-4xl w-14 h-14 flex items-center justify-center rounded-full bg-[#1e1e2a]">{homie.face_url || '🙂'}</div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold truncate">{homie.name}</h3>
          <p className="text-xs text-[var(--muted)]">voice: {homie.voice_id}</p>
        </div>
      </div>
      {homie.backstory && <p className="text-sm text-[var(--muted)] line-clamp-3">{homie.backstory}</p>}
      {homie.interests.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {homie.interests.map((i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded-full border border-[#2a2a38]">{i}</span>
          ))}
        </div>
      )}
      <AttentionBar value={homie.attention} />
      <div className="flex gap-2 text-sm">
        <Link href={`/mess-space/${homie.id}`} className="flex-1 text-center rounded-lg border border-[#2a2a38] py-1.5 hover:border-[var(--accent)]">Mess Space</Link>
        <Link href={`/dial/${homie.id}`} className="flex-1 text-center rounded-lg bg-[var(--accent)] py-1.5">Dial</Link>
        {onDelete && <button onClick={onDelete} className="px-2 text-[var(--muted)] hover:text-[#ff5c7c]" aria-label="Delete">✕</button>}
      </div>
    </div>
  );
}
