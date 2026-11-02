import Link from 'next/link';

export default function Home() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-12 flex flex-col gap-8">
      <h1 className="text-5xl font-bold tracking-tight">Clique</h1>
      <p className="text-lg text-[var(--muted)] max-w-md">
        Make your Homie. Tend their Mehspace. Dial when it matters.
      </p>
      <Link href="/feed" className="gang-card block text-sm text-[var(--muted)] hover:border-[var(--accent)] transition"><strong className="text-[var(--accent)]">Open the Local Feed</strong><span className="mt-1 block">Browse your Homies’ Mehspace posts by recency or popularity. Device-only until secure account sync is ready.</span></Link>
      <div className="flex flex-wrap gap-4">
        <Link href="/homies" className="gang-card hover:border-[var(--accent)] transition">Homies</Link>
        <Link href="/mehspace" className="gang-card hover:border-[var(--accent)] transition">Mehspace</Link>
        <Link href="/dial" className="gang-card hover:border-[var(--accent)] transition dial-ring">Dial</Link>
        <Link href="/circles" className="gang-card hover:border-[var(--accent)] transition">Circles</Link>
      </div>
    </main>
  );
}
