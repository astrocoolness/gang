'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const nextRaw = String(formData.get('next') ?? '/onboarding');
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/onboarding';
  if (!email) redirect('/auth/login?error=email');
  const supabase = await createClient();
  if (!supabase) redirect('/auth/login?error=not_configured');
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/clique/auth/callback?next=${encodeURIComponent(next)}` },
  });
  redirect(error ? '/auth/login?error=send' : '/auth/login?sent=1');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase?.auth.signOut();
  redirect('/');
}
