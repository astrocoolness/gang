export default function AttentionBar({ value }: { value: number }) {
  const color = value === 0 ? '#3a3a48' : value < 25 ? '#ff5c7c' : 'var(--accent)';
  return (
    <div className="w-full" title={`Attention ${value}/100`}>
      <div className="flex justify-between text-xs text-[var(--muted)] mb-1">
        <span>Attention</span>
        <span>{value === 0 ? 'Line muted' : `${value}/100`}</span>
      </div>
      <div className="h-2 rounded-full bg-[#2a2a38] overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}
