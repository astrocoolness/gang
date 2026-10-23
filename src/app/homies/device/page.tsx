import LocalHomies from '@/components/homies/LocalHomies';

export const metadata = { title: 'Device Homies · Clique' };

export default function DeviceHomiesPage() {
  return <LocalHomies notice={<p className="text-sm text-[var(--muted)]">These Homies live only in this browser (gang:v1).</p>} />;
}
