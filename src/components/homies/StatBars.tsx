const LABELS: Record<string, string> = {
  hunger: 'Fed', rest: 'Rest', happiness: 'Mood', cleanliness: 'Clean', energy: 'Energy', affection: 'Love', health: 'Health', fun: 'Fun',
};

export default function StatBars({ stats }: { stats: Record<string, number> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {Object.entries(LABELS).map(([k, label]) => {
        const v = Math.max(0, Math.min(100, Math.round(stats[k] ?? 0)));
        const color = v < 25 ? '#ff5c7c' : v < 50 ? '#f5b94a' : 'var(--accent)';
        return (
          <div key={k}>
            <dt className="flex justify-between text-xs text-[var(--muted)]"><span>{label}</span><span>{v}</span></dt>
            <dd className="h-2 rounded-full bg-[#1e1e2a] overflow-hidden" role="meter" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full" style={{ width: `${v}%`, background: color }} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
