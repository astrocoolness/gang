import 'server-only';
import { redirect } from 'next/navigation';
import { supabaseConfigured } from '@/lib/supabase/env';
import { getUser } from '@/lib/supabase/server';

/** Cloud Homies pages need Supabase + a session; otherwise fall back to device Homies or sign-in. */
export async function requireUser(next: string) {
  if (!supabaseConfigured) redirect('/homies');
  const user = await getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  return user;
}
