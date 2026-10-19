/**
 * "Import from this device": maps the browser-only gang:v1 store (src/lib/store.ts) onto Clique rows.
 * Pure + isomorphic so it can be unit-tested and shared by client preview and server action.
 * See docs/import-from-device.md.
 */
import type { Homie, MessSpace } from '@/types';

export const GANG_V1_KEY = 'gang:v1';
export const LEGACY_SOURCE = 'gang:v1';
const MAX_HOMIES = 200;
const MAX_POSTS_PER_SPACE = 500;

export interface GangV1Snapshot {
  homies: Homie[];
  spaces: MessSpace[];
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Defensive parse of untrusted JSON (localStorage or uploaded file). */
export function parseGangV1(raw: unknown): GangV1Snapshot {
  const obj = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<GangV1Snapshot> | null;
  if (!obj || typeof obj !== 'object') throw new Error('Not a gang:v1 export');
  const homies = (Array.isArray(obj.homies) ? obj.homies : []).slice(0, MAX_HOMIES).filter(
    (h): h is Homie => !!h && typeof h.id === 'string' && typeof h.name === 'string',
  );
  const ids = new Set(homies.map((h) => h.id));
  const spaces = (Array.isArray(obj.spaces) ? obj.spaces : []).filter(
    (s): s is MessSpace => !!s && typeof s.id === 'string' && ids.has(s.homie_id),
  );
  return { homies, spaces };
}

export interface ImportPlan {
  homies: {
    legacy_id: string;
    row: {
      kind: 'pet'; name: string; face: string; voice_id: string; backstory: string; interests: string[];
      attention: number; legacy_source: string; legacy_id: string;
    };
  }[];
  spaces: { homie_legacy_id: string; theme: string; layout_json: Record<string, unknown> }[];
  posts: { homie_legacy_id: string; author_legacy_id: string; legacy_id: string; body: string; created_at: string }[];
}

export function planGangV1Import(snap: GangV1Snapshot): ImportPlan {
  const homies = snap.homies.map((h) => ({
    legacy_id: h.id,
    row: {
      kind: 'pet' as const,
      name: str(h.name, 40).trim() || 'Homie',
      face: str(h.face_url, 16),
      voice_id: str(h.voice_id, 40),
      backstory: str(h.backstory, 2000),
      interests: (Array.isArray(h.interests) ? h.interests : []).map((i) => str(i, 60)).filter(Boolean).slice(0, 20),
      attention: Math.max(0, Math.min(100, Math.round(Number(h.attention) || 0))),
      legacy_source: LEGACY_SOURCE,
      legacy_id: h.id,
    },
  }));
  const spaces = snap.spaces.map((s) => ({
    homie_legacy_id: s.homie_id,
    theme: str(s.theme, 40) || 'night',
    layout_json: s.layout_json && typeof s.layout_json === 'object' ? s.layout_json : {},
  }));
  const posts = snap.spaces.flatMap((s) =>
    (Array.isArray(s.posts) ? s.posts : []).slice(0, MAX_POSTS_PER_SPACE)
      .filter((p) => p && typeof p.body === 'string' && p.body.trim())
      .map((p) => ({
        homie_legacy_id: s.homie_id,
        author_legacy_id: p.author_homie_id,
        legacy_id: p.id,
        body: p.body.slice(0, 5000),
        created_at: typeof p.created_at === 'string' ? p.created_at : new Date().toISOString(),
      })),
  );
  return { homies, spaces, posts };
}

export function summarizePlan(plan: ImportPlan) {
  return { homies: plan.homies.length, spaces: plan.spaces.length, posts: plan.posts.length };
}
