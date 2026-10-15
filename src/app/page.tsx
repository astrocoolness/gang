import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-6xl font-bold tracking-tight">GANG</h1>
      <p className="text-lg text-[var(--muted)] max-w-md text-center">
        Make your Homie. Tend their Mess Space. Dial when it matters.
      </p>
      <div className="flex gap-4">
        <Link href="/homies" className="gang-card hover:border-[var(--accent)] transition">
          Homies
        </Link>
        <Link href="/mess-space" className="gang-card hover:border-[var(--accent)] transition">
          Mess Space
        </Link>
        <Link href="/dial" className="gang-card hover:border-[var(--accent)] transition dial-ring">
          Dial
        </Link>
      </div>
    </main>
  );
}
