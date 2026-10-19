import { sendMagicLink } from './actions';
import { supabaseConfigured } from '@/lib/supabase/env';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; next?: string }> }) {
  const { sent, error, next } = await searchParams;
  return (
    <main className="max-w-sm mx-auto px-4 py-12 flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Sign in to Clique</h1>
      <p className="text-sm text-[var(--muted)]">Uses your rva.guru account. We&apos;ll email you a magic link.</p>
      {!supabaseConfigured && <p className="text-sm text-yellow-400">Auth isn&apos;t configured on this deployment yet.</p>}
      {sent && <p className="text-sm text-green-400">Check your email for the link.</p>}
      {error && <p className="text-sm text-red-400">Something went wrong ({error}).</p>}
      <form action={sendMagicLink} className="gang-card flex flex-col gap-3">
        <input type="hidden" name="next" value={next ?? '/onboarding'} />
        <input name="email" type="email" required placeholder="you@example.com"
          className="bg-[#0f0f16] border border-[#2a2a38] rounded-lg px-3 py-2" />
        <button className="rounded-lg bg-[var(--accent)] py-2">Send magic link</button>
      </form>
    </main>
  );
}
