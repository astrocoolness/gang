'use server';

import { createClient } from '@/lib/supabase/server';
import { LEGACY_SOURCE, parseGangV1, planGangV1Import, summarizePlan } from './device-import';

export interface ImportResult {
  ok: boolean;
  message: string;
  imported?: { homies: number; spaces: number; posts: number };
}

/**
 * Upserts a gang:v1 snapshot for the signed-in user under RLS (no service role).
 * Idempotent: rows carry legacy_source/legacy_id and already-imported homies are skipped.
 */
export async function importGangV1(json: string): Promise<ImportResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: 'Accounts are not configured on this deployment.' };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: 'Sign in first.' };
  if (json.length > 2_000_000) return { ok: false, message: 'That export is too large (2 MB max).' };

  let plan;
  try {
    plan = planGangV1Import(parseGangV1(json));
  } catch {
    return { ok: false, message: 'That does not look like a gang:v1 export.' };
  }
  const uid = auth.user.id;

  const { data: existing, error: exErr } = await supabase
    .from('clique_homies').select('id, legacy_id').eq('owner_id', uid).eq('legacy_source', LEGACY_SOURCE);
  if (exErr) return { ok: false, message: exErr.message };
  const idMap = new Map<string, string>((existing ?? []).map((r) => [r.legacy_id as string, r.id as string]));

  const fresh = plan.homies.filter((h) => !idMap.has(h.legacy_id));
  if (fresh.length) {
    const { data, error } = await supabase.from('clique_homies').insert(fresh.map((h) => h.row)).select('id, legacy_id');
    if (error) return { ok: false, message: error.message };
    for (const r of data ?? []) idMap.set(r.legacy_id as string, r.id as string);
  }

  let spaces = 0;
  let posts = 0;
  for (const s of plan.spaces) {
    const homieId = idMap.get(s.homie_legacy_id);
    if (!homieId) continue;
    const { data: space, error } = await supabase
      .from('clique_mehspaces')
      .upsert({ owner_type: 'homie', homie_id: homieId, theme: s.theme, layout_json: s.layout_json }, { onConflict: 'homie_id' })
      .select('id').single();
    if (error || !space) return { ok: false, message: error?.message ?? 'Could not create Mehspace' };
    spaces++;
    const rows = plan.posts
      .filter((p) => p.homie_legacy_id === s.homie_legacy_id)
      .map((p) => ({
        space_id: space.id, author_id: uid, as_homie_id: idMap.get(p.author_legacy_id) ?? homieId,
        body: p.body, created_at: p.created_at, legacy_source: LEGACY_SOURCE, legacy_id: p.legacy_id,
      }));
    if (!rows.length) continue;
    const { data: done } = await supabase
      .from('clique_posts').select('legacy_id').eq('space_id', space.id).eq('legacy_source', LEGACY_SOURCE);
    const seen = new Set((done ?? []).map((d) => d.legacy_id as string));
    const todo = rows.filter((r) => !seen.has(r.legacy_id));
    if (todo.length) {
      const { error: pErr } = await supabase.from('clique_posts').insert(todo);
      if (pErr) return { ok: false, message: pErr.message };
      posts += todo.length;
    }
  }
  const total = summarizePlan(plan);
  return {
    ok: true,
    message: `Imported ${fresh.length} new Homies (${total.homies} total), ${spaces} Mehspaces, ${posts} new posts.`,
    imported: { homies: fresh.length, spaces, posts },
  };
}
