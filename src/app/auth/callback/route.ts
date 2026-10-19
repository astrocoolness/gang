import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Magic-link / OAuth callback. Supabase redirect URL: https://rva.guru/clique/auth/callback */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';
  const supabase = await createClient();
  if (code && supabase) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    url.search = '';
    if (error || !data.user) {
      url.pathname = '/auth/login';
      url.searchParams.set('error', 'callback');
      return NextResponse.redirect(url);
    }
    // First sign-in (no Clique profile yet) goes to onboarding.
    const { data: profile } = await supabase.from('clique_profiles').select('id').eq('id', data.user.id).maybeSingle();
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
    url.pathname = profile ? safeNext : '/onboarding';
    return NextResponse.redirect(url);
  }
  url.pathname = '/auth/login';
  url.search = '?error=missing_code';
  return NextResponse.redirect(url);
}
