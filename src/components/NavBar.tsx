'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Home' },
  { href: '/dial', label: 'Dial' },
  { href: '/homies', label: 'Homies' },
  { href: '/mehspace', label: 'Mehspace' },
  { href: '/circles', label: 'Circles' },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-[#2a2a38] bg-[#0a0a0f]/95 backdrop-blur md:sticky md:top-0 md:bottom-auto md:border-t-0 md:border-b">
      <div className="max-w-4xl mx-auto flex items-center justify-around md:justify-start md:gap-6 px-4 py-3">
        <span className="hidden md:inline font-bold tracking-tight mr-4">CLIQUE</span>
        {TABS.map((t) => {
          const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href}
              className={`text-sm ${active ? 'text-[var(--accent)] font-semibold' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}>
              {t.label}
            </Link>
          );
        })}
        <Link href="/auth/login" className="hidden md:inline ml-auto text-sm text-[var(--muted)]">Sign in</Link>
      </div>
    </nav>
  );
}
