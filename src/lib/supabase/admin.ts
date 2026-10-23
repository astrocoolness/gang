import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './env';

/**
 * Service-role client for the ONE trusted step that needs it: writing sanitized Mehspace output
 * (rendered_html / rendered_css). Server-only; the key is never NEXT_PUBLIC. Returns null when the
 * key is not set, in which case custom HTML stays render_status = 'pending'.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!SUPABASE_URL || !key) return null;
  return createSupabaseClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
