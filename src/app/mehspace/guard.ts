import 'server-only';
import { redirect } from 'next/navigation';
import { supabaseConfigured } from '@/lib/supabase/env';
import { getUser } from '@/lib/supabase/server';

/** Cloud Mehspace pages need Supabase + a session; otherwise fall back to device Mehspaces or sign-in. */
export async function requireUser(next: string) {
  if (!supabaseConfigured) redirect('/mehspace');
  const user = await getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  return user;
}
