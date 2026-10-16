import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Magic-link / OAuth callback. Supabase redirect URL: https://rva.guru/clique/auth/callback */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';
  const supabase = await createClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    url.search = '';
    url.pathname = error ? '/auth/login' : next.startsWith('/') ? next : '/';
    if (error) url.searchParams.set('error', 'callback');
    return NextResponse.redirect(url);
  }
  url.pathname = '/auth/login';
  url.search = '?error=missing_code';
  return NextResponse.redirect(url);
}
