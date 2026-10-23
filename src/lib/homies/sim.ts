// Bridges the ported homies engine (a whole-household Save ticking one game minute per second)
// to Clique, where each pet Homie is one clique_homies row. A pet's sim is a one-Homie Save kept in
// clique_homies.profile.sim; care arrives as clique_homie_events and is replayed in order, so any
// viewer computes the same projection and editors persist it. Pure TS: no React, no Supabase.
import {
  bindProfiles, foodsOf, hatchLine, isBuiltin, nameOf, portraitOf, roomOf, stageLine, STAGE_LABEL, traitPhrases,
} from './engine/content';
import { coerceStoredProfile } from './engine/sheet';
import {
  applyAction, blank, describe, lifeDayOf, simulate, START_MINUTE, STAGE_AT, traitsFrom,
} from './engine/logic';
import type { Action, BuiltinId, CustomProfile, Food, LogEntry, MilestoneRecord, Save, Stage, Stats, Traits } from './engine/types';
import { HOMIE_IDS, SAVE_VERSION, STAGES, STAT_KEYS } from './engine/types';

/** Game minutes that pass per real minute. The homies game runs 60x; Clique pets live slower. */
export const GAME_MINUTES_PER_REAL_MINUTE = 6;
const MS_PER_GAME_MINUTE = 60_000 / GAME_MINUTES_PER_REAL_MINUTE;
const KEEP_LOG = 40;

export const ACTIONS = ['feed', 'play', 'clean', 'talk', 'sleep', 'wake', 'medicine'] as const satisfies readonly Action[];
export const FRIEND_ACTIONS = ['feed', 'play', 'clean', 'talk'] as const satisfies readonly Action[];
export const SPECIES = [...HOMIE_IDS, 'custom'] as const;
export type Species = (typeof SPECIES)[number];

export type PetSim = {
  v: 1;
  engineId: string;
  save: Save;
  /** Wall-clock ms the save's gameMinute corresponds to. */
  syncedMs: number;
  /** Replay cursor over care events: newest applied created_at and the ids applied at exactly that instant. */
  appliedAt: string | null;
  appliedIds: string[];
};

export type CareEvent = { id: string; created_at: string; actor_id: string | null; payload: Record<string, unknown> };

export function isAction(v: unknown): v is Action {
  return typeof v === 'string' && (ACTIONS as readonly string[]).includes(v);
}
export function isFriendAction(v: unknown): v is Action {
  return typeof v === 'string' && (FRIEND_ACTIONS as readonly string[]).includes(v);
}
export function isSpecies(v: unknown): v is Species {
  return typeof v === 'string' && (SPECIES as readonly string[]).includes(v);
}

export function engineIdFor(homieId: string, species: Species) {
  return species === 'custom' ? `c${homieId.replace(/[^a-f0-9]/gi, '').slice(0, 12).toLowerCase()}` : species;
}

/** A freshly hatched pet at the chosen life stage. */
export function newPetSim(opts: { homieId: string; species: Species; custom?: CustomProfile | null; stage?: Stage; nowMs: number }): PetSim {
  const id = engineIdFor(opts.homieId, opts.species);
  const stage: Stage = opts.stage && STAGES.includes(opts.stage) ? opts.stage : 'baby';
  const offset = STAGE_AT.find((row) => row.stage === stage)?.hours ?? 0;
  const h = blank(opts.species === 'custom' ? 'tony' : opts.species);
  if (opts.species === 'custom') {
    if (!opts.custom) throw new Error('custom pets need a profile');
    const shaped = structuredClone(opts.custom);
    shaped.milestones = shaped.milestones.map((m) => ({ ...m, minHours: m.minHours + offset }));
    h.profile = shaped;
    h.traits = traitsFrom(shaped.descriptors);
  }
  h.stage = stage;
  h.stageOffsetHours = offset;
  h.hatchedAt = START_MINUTE;
  h.lastViewed = START_MINUTE;
  const save: Save = {
    version: SAVE_VERSION,
    originMs: opts.nowMs - START_MINUTE * MS_PER_GAME_MINUTE,
    lastWallMs: opts.nowMs,
    gameMinute: START_MINUTE,
    activeId: id,
    muted: true,
    order: isBuiltin(id) ? [] : [id],
    homies: { [id]: h },
    log: [],
    milestones: [],
  };
  bindProfiles(save.homies);
  const title = h.profile?.hatch ?? hatchLine(id);
  save.log.push({ id: `${START_MINUTE}-${id}-0`, homieId: id, at: START_MINUTE, text: title, kind: 'milestone' });
  save.milestones.push({ id: `${id}-hatch`, homieId: id, at: START_MINUTE, title });
  return { v: 1, engineId: id, save, syncedMs: opts.nowMs, appliedAt: null, appliedIds: [] };
}

function num(v: unknown, d: number) {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

/** Validate a sim read back from jsonb. Anything malformed returns null (caller re-hatches). */
export function readSim(raw: unknown): PetSim | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<PetSim>;
  if (r.v !== 1 || typeof r.engineId !== 'string' || !r.save || typeof r.save !== 'object') return null;
  const id = r.engineId;
  const builtin = isBuiltin(id);
  if (!builtin && !/^c[a-z0-9]{4,16}$/.test(id)) return null;
  const incoming = r.save.homies?.[id];
  if (!incoming) return null;
  const seed = blank(builtin ? (id as BuiltinId) : 'tony');
  const profile = builtin ? null : coerceStoredProfile(incoming.profile);
  if (!builtin && !profile) return null;
  if (profile && incoming.profile) profile.milestones = (incoming.profile as CustomProfile).milestones ?? profile.milestones;
  const h = {
    ...seed,
    ...incoming,
    stats: { ...seed.stats, ...incoming.stats },
    traits: { ...seed.traits, ...incoming.traits },
    noted: incoming.noted ?? {},
    stage: STAGES.includes(incoming.stage) ? incoming.stage : seed.stage,
    profile,
  };
  for (const k of STAT_KEYS) h.stats[k] = Math.max(0, Math.min(100, num(h.stats[k], seed.stats[k])));
  const gameMinute = num(r.save.gameMinute, START_MINUTE);
  const save: Save = {
    version: SAVE_VERSION,
    originMs: num(r.save.originMs, 0),
    lastWallMs: num(r.save.lastWallMs, 0),
    gameMinute,
    activeId: id,
    muted: true,
    order: builtin ? [] : [id],
    homies: { [id]: h },
    log: Array.isArray(r.save.log) ? r.save.log.filter((l) => l && typeof l.text === 'string').slice(-KEEP_LOG) : [],
    milestones: Array.isArray(r.save.milestones) ? r.save.milestones.filter((m) => m && typeof m.title === 'string') : [],
  };
  return {
    v: 1,
    engineId: id,
    save,
    syncedMs: num(r.syncedMs, Date.now()),
    appliedAt: typeof r.appliedAt === 'string' ? r.appliedAt : null,
    appliedIds: Array.isArray(r.appliedIds) ? r.appliedIds.filter((x): x is string => typeof x === 'string').slice(-50) : [],
  };
}

/** Run the sim forward to wall-clock `toMs`. */
export function advance(sim: PetSim, toMs: number): PetSim {
  const delta = Math.floor((toMs - sim.syncedMs) / MS_PER_GAME_MINUTE);
  if (delta <= 0) return sim;
  const save = simulate(sim.save, sim.save.gameMinute + delta);
  return { ...sim, save: { ...save, lastWallMs: toMs }, syncedMs: sim.syncedMs + delta * MS_PER_GAME_MINUTE };
}

export function careNow(sim: PetSim, action: Action, foodId?: string) {
  const res = applyAction(sim.save, sim.engineId, action, foodId);
  return { sim: { ...sim, save: res.save }, text: res.toast ?? res.speech ?? '', sound: res.sound };
}

export type Projection = {
  sim: PetSim;
  /** Event id -> what happened, for events applied in this projection. */
  results: Record<string, string>;
  applied: number;
  evolved: { from: Stage; to: Stage; line: string } | null;
};

/** Replay unapplied care events (oldest first) and advance to now. Deterministic apart from flavor text. */
export function project(start: PetSim, events: CareEvent[], nowMs: number): Projection {
  let sim = start;
  const from = stageOf(sim);
  const results: Record<string, string> = {};
  const seen = new Set(sim.appliedIds);
  const sorted = [...events].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1));
  let applied = 0;
  for (const e of sorted) {
    if (sim.appliedAt && (e.created_at < sim.appliedAt || (e.created_at === sim.appliedAt && seen.has(e.id)))) continue;
    const action = e.payload?.action;
    sim = advance(sim, Date.parse(e.created_at));
    if (isAction(action)) {
      const food = typeof e.payload.food === 'string' ? e.payload.food : undefined;
      const r = careNow(sim, action, food);
      sim = r.sim;
      results[e.id] = r.text;
    }
    applied += 1;
    if (sim.appliedAt !== e.created_at) {
      sim = { ...sim, appliedAt: e.created_at, appliedIds: [e.id] };
      seen.clear();
    } else {
      sim = { ...sim, appliedIds: [...sim.appliedIds, e.id] };
    }
    seen.add(e.id);
  }
  sim = advance(sim, nowMs);
  const to = stageOf(sim);
  bindProfiles(sim.save.homies);
  const evolved = to !== from ? { from, to, line: stageLine(sim.engineId, to) || `${nameOf(sim.engineId)} grew up a little.` } : null;
  return { sim, results, applied, evolved };
}

export function stageOf(sim: PetSim): Stage {
  return sim.save.homies[sim.engineId].stage;
}

/** Trim before persisting to jsonb. */
export function compact(sim: PetSim): PetSim {
  return {
    ...sim,
    save: { ...sim.save, log: sim.save.log.slice(-KEEP_LOG), milestones: sim.save.milestones.slice(-KEEP_LOG) },
  };
}

export type PetView = {
  engineId: string;
  name: string;
  stage: Stage;
  stageLabel: string;
  lifeDay: number;
  clock: string;
  status: string;
  sleeping: boolean;
  sick: boolean;
  working: boolean;
  stats: Stats;
  traits: Traits;
  traitPhrases: string[];
  foods: Food[];
  craving: Food;
  portrait: string;
  room: string | null;
  log: LogEntry[];
  milestones: MilestoneRecord[];
};

export function viewOf(sim: PetSim): PetView {
  const { save, engineId: id } = sim;
  bindProfiles(save.homies);
  const h = save.homies[id];
  const d = describe(save, id);
  const round = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
  return {
    engineId: id,
    name: nameOf(id),
    stage: h.stage,
    stageLabel: STAGE_LABEL[h.stage],
    lifeDay: lifeDayOf(h, save.gameMinute),
    clock: d.clock.label,
    status: d.line,
    sleeping: h.sleeping,
    sick: h.sick,
    working: d.working,
    stats: round(h.stats) as Stats,
    traits: round(h.traits) as Traits,
    traitPhrases: traitPhrases(h.traits),
    foods: foodsOf(id),
    craving: d.food,
    portrait: portraitOf(id, h.stage),
    room: roomOf(id),
    log: [...save.log].reverse().slice(0, 15),
    milestones: [...save.milestones].reverse(),
  };
}

/** Columns mirrored out of the sim for listing/querying. */
export function columnsOf(sim: PetSim) {
  const h = sim.save.homies[sim.engineId];
  const round = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
  return { stage: h.stage, stats: round(h.stats), traits: round(h.traits) };
}
