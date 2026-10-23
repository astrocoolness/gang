// Ported from astrocoolness/homies@b55a357 src/game/logic.ts (plain TS, no framework deps).
import {
  bindProfiles,
  careSpeech,
  collapseText,
  cravingOf,
  customOf,
  feedLine,
  foodsOf,
  hatchLine,
  isBuiltin,
  MILESTONES,
  nameOf,
  napText,
  needLine,
  playLine,
  cleanLine,
  rollBeat,
  scheduleOf,
  sickLine,
  sleepText,
  slipText,
  stageLine,
  statusLine,
  talkLine,
  urgentLine,
  wakeLine,
  wellLine,
} from "./content";
import { isCatalogId, originalStylePortrait, rollStarters } from "./cast";
import { coerceStoredProfile } from "./sheet";
import type { Action, CustomProfile, HomieId, HomieState, LogKind, Recap, Save, Sound, Stage, Stats, Traits } from "./types";
import { HOMIE_IDS, SAVE_VERSION, STAGES } from "./types";

export const MS_PER_GAME_MINUTE = 1000;
export const DAY = 24 * 60;
export const START_MINUTE = 8 * 60;

export const STAGE_AT: { stage: Stage; hours: number }[] = [
  { stage: "baby", hours: 0 },
  { stage: "kid", hours: 8 },
  { stage: "teen", hours: 28 },
  { stage: "adult", hours: 72 },
  { stage: "elder", hours: 168 },
];

const KEY = "homies.save.v1";

export function clamp(n: number, a = 0, b = 100) {
  if (!Number.isFinite(n)) return a;
  return Math.max(a, Math.min(b, n));
}

export function clock(minute: number) {
  const day = Math.floor(minute / DAY) + 1;
  const tod = ((minute % DAY) + DAY) % DAY;
  const hour = Math.floor(tod / 60);
  const min = tod % 60;
  const h12 = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  const label = `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
  return { day, hour, min, label, tod };
}

export function ageHours(h: HomieState, now: number) {
  if (h.hatchedAt == null) return 0;
  return Math.max(0, (now - h.hatchedAt) / 60 + (h.stageOffsetHours || 0));
}

export function lifeDayOf(h: HomieState, now: number) {
  if (h.hatchedAt == null) return 1;
  return Math.floor((now - h.hatchedAt) / DAY) + 1;
}

export function stageFor(hours: number): Stage {
  if (hours < 8) return "baby";
  if (hours < 28) return "kid";
  if (hours < 72) return "teen";
  if (hours < 168) return "adult";
  return "elder";
}

export function idsOf(save: Save): HomieId[] {
  const extra = Array.isArray(save.order) ? save.order : [];
  const seen = new Set<string>();
  const ids: HomieId[] = [];
  for (const id of [...HOMIE_IDS, ...extra]) {
    if (seen.has(id) || !save.homies[id]) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function anyHatched(save: Save) {
  return idsOf(save).some((id) => save.homies[id].hatchedAt != null);
}

export function isNight(id: HomieId, hour: number) {
  const { bed, wake } = scheduleOf(id);
  if (bed > wake) return hour >= bed || hour < wake;
  return hour >= bed && hour < wake;
}

export function isWorking(id: HomieId, stage: Stage, hour: number, sleeping: boolean) {
  if (sleeping) return false;
  if (stage === "baby" || stage === "kid") return false;
  const [a, b] = scheduleOf(id).work;
  if (a <= b) return hour >= a && hour < b;
  return hour >= a || hour < b;
}

export function nextWakeMinute(now: number, wakeHour: number) {
  const c = clock(now);
  const today = now - c.tod + wakeHour * 60;
  return now < today ? today : today + DAY;
}

export function blank(id: HomieId): HomieState {
  const traits: Traits =
    id === "tony"
      ? { diet: 48, playful: 62, bond: 44, grit: 34 }
      : id === "betty"
        ? { diet: 68, playful: 40, bond: 52, grit: 70 }
        : { diet: 52, playful: 58, bond: 38, grit: 48 };
  const stats: Stats = {
    hunger: id === "tony" ? 54 : 64,
    rest: 78,
    happiness: 70,
    cleanliness: 90,
    energy: 74,
    affection: 60,
    health: 92,
    fun: 66,
  };
  return {
    hatchedAt: null,
    sleeping: false,
    wakeAt: null,
    sick: false,
    stage: "baby",
    stats,
    traits,
    noted: {},
    beatCooldown: 1,
    lastBeatId: "",
    lastViewed: 0,
    profile: null,
    stageOffsetHours: 0,
  };
}

export function freshSave(now: number): Save {
  const order: HomieId[] = [];
  const homies: Save["homies"] = {};
  for (const starter of rollStarters()) {
    const homie = blank(starter.id);
    homie.profile = starter.profile;
    homie.traits = traitsFrom(starter.profile.descriptors);
    homies[starter.id] = homie;
    order.push(starter.id);
  }
  return {
    version: SAVE_VERSION,
    originMs: now - START_MINUTE * MS_PER_GAME_MINUTE,
    lastWallMs: now,
    gameMinute: START_MINUTE,
    activeId: order[0] ?? "tony",
    muted: false,
    order,
    homies,
    log: [],
    milestones: [],
  };
}

export function normalizeSave(raw: unknown, now: number): Save {
  if (!raw || typeof raw !== "object") return freshSave(now);
  const r = raw as Partial<Save>;
  if ((r.version !== 1 && r.version !== SAVE_VERSION && r.version !== 3) || !r.homies) return freshSave(now);
  const homies: Save["homies"] = {};
  for (const id of HOMIE_IDS) {
    const incoming = r.homies[id];
    if (!incoming) continue;
    const seed = blank(id);
    homies[id] = {
      ...seed,
      ...incoming,
      stats: { ...seed.stats, ...incoming.stats },
      traits: { ...seed.traits, ...incoming.traits },
      noted: incoming.noted ?? {},
      profile: null,
      stageOffsetHours: 0,
    };
  }
  const requested = Array.isArray(r.order) ? r.order.filter((id): id is string => typeof id === "string") : [];
  for (const id of requested) {
    if (isBuiltin(id) || homies[id]) continue;
    if (!id.startsWith("c") && !id.startsWith("g")) continue;
    const incoming = r.homies[id];
    const profile = coerceStoredProfile(incoming?.profile);
    if (!incoming || !profile) continue;
    if (id.startsWith("g") && profile.portrait.startsWith("data:image/svg")) {
      profile.portrait = originalStylePortrait(id);
    }
    const seed = blank("tony");
    homies[id] = {
      ...seed,
      ...incoming,
      stats: { ...seed.stats, ...incoming.stats },
      traits: { ...seed.traits, ...incoming.traits },
      noted: incoming.noted ?? {},
      profile,
      stageOffsetHours: typeof incoming.stageOffsetHours === "number" ? incoming.stageOffsetHours : 0,
    };
  }
  if (Object.keys(homies).length === 0) return freshSave(now);
  const hatched = Object.values(homies).some((homie) => homie.hatchedAt != null);
  if (!hatched) {
    const ids = Object.keys(homies);
    const pair = ids.length === 2 && ids.every((id) => isCatalogId(id));
    if (!pair) return freshSave(now);
  }
  const order = [
    ...HOMIE_IDS.filter((id) => homies[id]),
    ...requested.filter((id) => !isBuiltin(id) && homies[id]),
  ];
  const activeOk = !!r.activeId && !!homies[r.activeId];
  return {
    version: SAVE_VERSION,
    originMs: typeof r.originMs === "number" ? r.originMs : now - START_MINUTE * MS_PER_GAME_MINUTE,
    lastWallMs: now,
    gameMinute: typeof r.gameMinute === "number" ? r.gameMinute : START_MINUTE,
    activeId: activeOk ? r.activeId! : order[0],
    muted: !!r.muted,
    order,
    homies,
    log: Array.isArray(r.log) ? r.log.filter((entry) => entry && homies[entry.homieId]).slice(-200) : [],
    milestones: Array.isArray(r.milestones) ? r.milestones.filter((mark) => mark && homies[mark.homieId]) : [],
  };
}

export function loadSave(now: number): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSave(now);
    return normalizeSave(JSON.parse(raw) as unknown, now);
  } catch {
    try {
      const bak = localStorage.getItem(`${KEY}.bak`);
      if (bak) return normalizeSave(JSON.parse(bak) as unknown, now);
    } catch {
      /* fall through */
    }
    return freshSave(now);
  }
}

export function persistSave(save: Save) {
  try {
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(`${KEY}.bak`, prev);
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode / quota */
  }
}

function pushLog(save: Save, homieId: HomieId, text: string, kind: LogKind) {
  save.log.push({
    id: `${save.gameMinute}-${homieId}-${save.log.length}`,
    homieId,
    at: save.gameMinute,
    text,
    kind,
  });
  if (save.log.length > 200) save.log.splice(0, save.log.length - 200);
}

function rates(id: HomieId, stage: Stage, sleeping: boolean, working: boolean): Stats {
  if (sleeping) {
    return {
      hunger: -2.2,
      rest: 15,
      happiness: 0.3,
      cleanliness: -0.25,
      energy: 13,
      affection: -0.12,
      health: 0.7,
      fun: -0.35,
    };
  }
  const custom = customOf(id);
  const base: Stats = custom
    ? {
        hunger: custom.pace === "wired" ? -7.2 : custom.pace === "slow" ? -5.8 : -6.6,
        rest: custom.pace === "wired" ? -2.4 : custom.pace === "slow" ? -6.2 : -5.2,
        happiness: 0,
        cleanliness: custom.pace === "slow" ? -4.2 : -3.2,
        energy: custom.pace === "wired" ? -5 : -5.4,
        affection: -1.1,
        health: 0,
        fun: custom.pace === "wired" ? -6.4 : custom.pace === "slow" ? -4.4 : -5.4,
      }
    : {
        hunger: id === "betty" ? -6.2 : id === "nori" ? -7 : -8.4,
        rest: id === "nori" ? -2.5 : id === "betty" ? -5.4 : -6.4,
        happiness: 0,
        cleanliness: id === "tony" ? -4.6 : id === "betty" ? -3 : -2,
        energy: id === "nori" ? -5.2 : -5.6,
        affection: -1.1,
        health: 0,
        fun: id === "nori" ? -6.8 : id === "betty" ? -4.2 : -6,
      };
  if (stage === "baby") {
    base.hunger -= 2;
    base.rest -= 1.4;
    base.energy -= 1;
  }
  if (working) {
    base.energy -= 1.8;
    base.fun -= 1.1;
    base.hunger -= 0.7;
  }
  return base;
}

function decayMinute(h: HomieState, id: HomieId, working: boolean) {
  const per = rates(id, h.stage, h.sleeping, working);
  (Object.keys(per) as (keyof Stats)[]).forEach((key) => {
    if (key === "happiness" || key === "health") return;
    h.stats[key] = clamp(h.stats[key] + per[key] / 60);
  });
  const comfort =
    (h.stats.hunger + h.stats.rest + h.stats.cleanliness + h.stats.energy + h.stats.fun + h.stats.affection) / 6;
  h.stats.happiness = clamp(h.stats.happiness + ((comfort - h.stats.happiness) * 0.2) / 60);
  let healthHour = 0;
  if (h.stats.hunger < 18) healthHour -= 3.2;
  if (h.stats.rest < 15) healthHour -= 2.4;
  if (h.stats.cleanliness < 16) healthHour -= 2.2;
  if (h.stats.energy < 15) healthHour -= 2;
  if (healthHour === 0 && h.stats.hunger > 45 && h.stats.rest > 40 && h.stats.cleanliness > 40) healthHour += 0.9;
  if (h.traits.diet < 30) healthHour -= 0.55;
  if (h.traits.diet > 76) healthHour += 0.3;
  if (h.sleeping) healthHour += 0.6;
  h.stats.health = clamp(h.stats.health + healthHour / 60);
  if (!h.sleeping && working) h.traits.grit = clamp(h.traits.grit + 0.35 / 60);
  if (h.stats.affection < 26) h.traits.bond = clamp(h.traits.bond - 0.65 / 60);
  else if (h.stats.affection > 72 && h.stats.happiness > 62) h.traits.bond = clamp(h.traits.bond + 0.22 / 60);
}

function checkMilestones(save: Save, id: HomieId) {
  const h = save.homies[id];
  if (h.hatchedAt == null) return;
  const hours = ageHours(h, save.gameMinute);
  if (h.profile) {
    for (const m of h.profile.milestones) {
      const mid = `${id}:${m.id}`;
      if (save.milestones.some((x) => x.id === mid)) continue;
      if (hours < m.minHours) continue;
      save.milestones.push({ id: mid, homieId: id, at: save.gameMinute, title: m.title });
      pushLog(save, id, m.title, "milestone");
    }
    return;
  }
  for (const m of MILESTONES) {
    if (m.homieId !== id) continue;
    if (save.milestones.some((x) => x.id === m.id)) continue;
    if (hours < m.minHours) continue;
    if (m.test && !m.test(h)) continue;
    save.milestones.push({ id: m.id, homieId: id, at: save.gameMinute, title: m.title });
    pushLog(save, id, m.title, "milestone");
  }
}

function noteNeeds(save: Save, id: HomieId) {
  const h = save.homies[id];
  if (h.hatchedAt == null || h.sleeping) return;
  if (ageHours(h, save.gameMinute) < 0.4) return;
  if (save.log.some((l) => l.homieId === id && l.at === save.gameMinute)) return;
  const watch: (keyof Stats)[] = ["hunger", "rest", "cleanliness", "fun", "energy", "affection"];
  const lows: Record<string, number> = {
    hunger: 22,
    rest: 20,
    cleanliness: 20,
    fun: 20,
    energy: 18,
    affection: 24,
  };
  for (const key of watch) {
    const low = lows[key];
    if (h.stats[key] < low) {
      if (!h.noted[key]) {
        h.noted[key] = true;
        pushLog(save, id, needLine(id, key), "life");
        return;
      }
    } else if (h.stats[key] > low + 22) {
      h.noted[key] = false;
    }
  }
  if (h.stats.health < 38 && !h.sick) {
    h.sick = true;
    pushLog(save, id, sickLine(id), "life");
  } else if (h.stats.health > 70 && h.sick) {
    h.sick = false;
    pushLog(save, id, wellLine(id), "life");
  }
}

function putToSleep(save: Save, id: HomieId, how: "schedule" | "collapse" | "night" | "nap") {
  const h = save.homies[id];
  if (h.sleeping) return;
  const c = clock(save.gameMinute);
  h.sleeping = true;
  if (how === "nap") h.wakeAt = save.gameMinute + 120;
  else if (how === "collapse" && !isNight(id, c.hour)) h.wakeAt = save.gameMinute + 150;
  else h.wakeAt = nextWakeMinute(save.gameMinute, scheduleOf(id).wake);
  const text = how === "collapse" ? collapseText(id) : how === "nap" ? napText(id) : sleepText(id);
  pushLog(save, id, text, "life");
  if (how === "night" || how === "schedule") h.traits.grit = clamp(h.traits.grit + 1);
}

function wakeNatural(save: Save, id: HomieId) {
  const h = save.homies[id];
  if (!h.sleeping) return;
  h.sleeping = false;
  h.wakeAt = null;
  pushLog(save, id, wakeLine(id, clock(save.gameMinute).label), "life");
}

function onTheHour(save: Save, id: HomieId) {
  const h = save.homies[id];
  if (h.sleeping || h.hatchedAt == null) return;
  h.beatCooldown -= 1;
  if (h.beatCooldown > 0) return;
  const c = clock(save.gameMinute);
  const ctx = {
    id,
    name: nameOf(id),
    stage: h.stage,
    hour: c.hour,
    minuteLabel: c.label,
    stats: h.stats,
    traits: h.traits,
    others: idsOf(save).filter((o) => o !== id && save.homies[o].hatchedAt != null),
    lifeDay: lifeDayOf(h, save.gameMinute),
  };
  const beat = rollBeat(ctx, h.lastBeatId);
  h.lastBeatId = beat.id;
  h.beatCooldown = 2 + Math.floor(Math.random() * 2);
  pushLog(save, id, beat.text, "life");
}

function tick(save: Save) {
  save.gameMinute += 1;
  const c = clock(save.gameMinute);
  for (const id of idsOf(save)) {
    const h = save.homies[id];
    if (h.hatchedAt == null) continue;
    const stage = stageFor(ageHours(h, save.gameMinute));
    if (stage !== h.stage) {
      const prevI = STAGES.indexOf(h.stage);
      const nextI = STAGES.indexOf(stage);
      for (let i = prevI + 1; i <= nextI; i += 1) {
        const stepped = STAGES[i];
        const line = stageLine(id, stepped);
        if (!line) continue;
        pushLog(save, id, line, "milestone");
        save.milestones.push({
          id: `${id}-stage-${stepped}`,
          homieId: id,
          at: save.gameMinute,
          title: line,
        });
      }
      h.stage = stage;
    }
    const working = isWorking(id, h.stage, c.hour, h.sleeping);
    if (h.sleeping && h.wakeAt != null && !isNight(id, c.hour) && h.stats.rest > 92 && h.stats.energy > 88) {
      h.wakeAt = save.gameMinute;
    }
    decayMinute(h, id, working);
    if (h.sleeping && h.wakeAt != null && save.gameMinute >= h.wakeAt) wakeNatural(save, id);
    if (!h.sleeping && c.tod === scheduleOf(id).bed * 60) putToSleep(save, id, "schedule");
    if (!h.sleeping && h.stats.rest < 8) putToSleep(save, id, "collapse");
    if (c.min === 0) onTheHour(save, id);
    noteNeeds(save, id);
    checkMilestones(save, id);
  }
}

function weather(save: Save, days: number) {
  for (const id of idsOf(save)) {
    const h = save.homies[id];
    if (h.hatchedAt == null) continue;
    h.stats.hunger = Math.min(h.stats.hunger, 34);
    h.stats.cleanliness = Math.min(h.stats.cleanliness, 30);
    h.stats.fun = Math.min(h.stats.fun, 36);
    h.stats.energy = Math.min(h.stats.energy, 40);
    h.stats.rest = 42;
    h.stats.affection = clamp(h.stats.affection - Math.min(30, 5 * days));
    h.stats.health = clamp(Math.max(18, h.stats.health - Math.min(36, 3 * days)));
    h.traits.bond = clamp(h.traits.bond - Math.min(24, 4 * days));
    h.sleeping = false;
    h.wakeAt = null;
    pushLog(save, id, slipText(id), "life");
  }
}

export function simulate(save: Save, targetMinute: number): Save {
  bindProfiles(save.homies);
  if (targetMinute <= save.gameMinute) return save;
  const next = structuredClone(save);
  const span = targetMinute - next.gameMinute;
  if (span > 4 * DAY) {
    const days = Math.max(1, Math.floor(span / DAY) - 1);
    weather(next, days);
    next.gameMinute = targetMinute - 12 * 60;
  }
  let guard = 0;
  while (next.gameMinute < targetMinute && guard < 20000) {
    tick(next);
    guard += 1;
  }
  return next;
}

export function targetMinute(save: Save, now = Date.now()) {
  return Math.floor((now - save.originMs) / MS_PER_GAME_MINUTE);
}

export type ActionResult = {
  save: Save;
  toast: string | null;
  speech: string | null;
  sound: Sound;
};

function scale(n: number, k: number) {
  return n * k;
}

export function applyAction(save: Save, id: HomieId, action: Action, foodId?: string): ActionResult {
  bindProfiles(save.homies);
  const next = structuredClone(save);
  const h = next.homies[id];
  if (!h || h.hatchedAt == null) return { save: next, toast: "Still an egg.", speech: null, sound: "no" };
  const name = nameOf(id);
  const asleep = h.sleeping;
  const k = asleep ? 0.55 : 1;

  if (action === "wake") {
    if (!h.sleeping) return { save: next, toast: `${name} is already up.`, speech: null, sound: "no" };
    const early = h.stats.rest < 58;
    h.sleeping = false;
    h.wakeAt = null;
    if (early) {
      h.stats.happiness = clamp(h.stats.happiness - 6);
      h.traits.grit = clamp(h.traits.grit - 2);
    }
    const speech = careSpeech(id, early ? "wake-early" : "wake-ok");
    pushLog(next, id, speech, "care");
    return { save: next, toast: speech, speech: null, sound: "wake" };
  }

  if (action === "sleep") {
    if (h.sleeping) return { save: next, toast: `${name} is already resting.`, speech: null, sound: "no" };
    const c = clock(next.gameMinute);
    const bed = scheduleOf(id).bed;
    const windDown = bed >= 18 && c.hour >= bed - 2 && c.hour < bed;
    const long = isNight(id, c.hour) || windDown || h.stats.rest < 40;
    putToSleep(next, id, long ? "night" : "nap");
    const text = next.log[next.log.length - 1]?.text ?? sleepText(id);
    return { save: next, toast: text, speech: null, sound: "sleep" };
  }

  if (action === "medicine") {
    if (h.stats.health >= 70 && !h.sick) {
      return { save: next, toast: `${name} isn't sick.`, speech: null, sound: "no" };
    }
    h.stats.health = clamp(h.stats.health + 34);
    h.stats.happiness = clamp(h.stats.happiness - 3);
    if (h.stats.health > 64) h.sick = false;
    const text = careSpeech(id, "medicine");
    pushLog(next, id, text, "care");
    return { save: next, toast: text, speech: null, sound: "med" };
  }

  if (action === "feed") {
    const list = foodsOf(id);
    const food = list.find((f) => f.id === foodId) ?? list[0];
    const kind = food.kind;
    if (kind === "meal") {
      h.stats.hunger = clamp(h.stats.hunger + scale(36, k));
      h.stats.happiness = clamp(h.stats.happiness + scale(8, k));
      h.stats.energy = clamp(h.stats.energy + scale(5, k));
      h.stats.cleanliness = clamp(h.stats.cleanliness - 2);
      h.traits.diet = clamp(h.traits.diet + 3);
      h.traits.bond = clamp(h.traits.bond + 1);
    } else if (kind === "fav") {
      h.stats.hunger = clamp(h.stats.hunger + scale(32, k));
      h.stats.happiness = clamp(h.stats.happiness + scale(18, k));
      h.stats.affection = clamp(h.stats.affection + scale(10, k));
      h.stats.fun = clamp(h.stats.fun + scale(4, k));
      h.traits.diet = clamp(h.traits.diet + 1);
      h.traits.bond = clamp(h.traits.bond + 3);
    } else {
      h.stats.hunger = clamp(h.stats.hunger + scale(28, k));
      h.stats.happiness = clamp(h.stats.happiness + scale(11, k));
      h.stats.fun = clamp(h.stats.fun + scale(7, k));
      h.stats.energy = clamp(h.stats.energy - 3);
      h.stats.cleanliness = clamp(h.stats.cleanliness - 7);
      h.stats.health = clamp(h.stats.health - 4);
      h.traits.diet = clamp(h.traits.diet - 7);
      h.traits.playful = clamp(h.traits.playful + 1);
    }
    const text = feedLine(id, food, h.stage, asleep);
    pushLog(next, id, text, "care");
    checkMilestones(next, id);
    return { save: next, toast: text, speech: null, sound: "feed" };
  }

  if (action === "play") {
    h.stats.fun = clamp(h.stats.fun + scale(32, k));
    h.stats.happiness = clamp(h.stats.happiness + scale(12, k));
    h.stats.energy = clamp(h.stats.energy - (asleep ? 4 : 14));
    h.stats.rest = clamp(h.stats.rest - (asleep ? 2 : 7));
    h.stats.affection = clamp(h.stats.affection + scale(6, k));
    h.traits.playful = clamp(h.traits.playful + 4);
    h.traits.grit = clamp(h.traits.grit - 1);
    h.traits.bond = clamp(h.traits.bond + 1);
    const text = playLine(id, h.stage);
    pushLog(next, id, text, "care");
    checkMilestones(next, id);
    return { save: next, toast: text, speech: null, sound: "play" };
  }

  if (action === "clean") {
    h.stats.cleanliness = clamp(h.stats.cleanliness + scale(46, k));
    h.stats.happiness = clamp(h.stats.happiness + scale(6, k));
    h.stats.energy = clamp(h.stats.energy - (asleep ? 2 : 7));
    const text = cleanLine(id, h.stage);
    pushLog(next, id, text, "care");
    return { save: next, toast: text, speech: null, sound: "clean" };
  }

  if (action === "talk") {
    h.stats.affection = clamp(h.stats.affection + scale(16, k));
    h.stats.happiness = clamp(h.stats.happiness + scale(10, k));
    h.stats.fun = clamp(h.stats.fun + scale(4, k));
    h.traits.bond = clamp(h.traits.bond + (asleep ? 1 : 3));
    const speech = talkLine(id, h, asleep);
    pushLog(next, id, speech, "care");
    checkMilestones(next, id);
    return { save: next, toast: null, speech, sound: "talk" };
  }

  return { save: next, toast: null, speech: null, sound: "no" };
}

export function hatchHomie(save: Save, id: HomieId, nowMs: number): Save {
  bindProfiles(save.homies);
  if (!save.homies[id] || save.homies[id].hatchedAt != null) return save;
  const next = structuredClone(save);
  if (!anyHatched(save)) {
    next.gameMinute = START_MINUTE;
    next.originMs = nowMs - START_MINUTE * MS_PER_GAME_MINUTE;
  }
  const h = next.homies[id];
  h.hatchedAt = next.gameMinute;
  h.lastViewed = next.gameMinute;
  h.stage = "baby";
  h.sleeping = false;
  h.wakeAt = null;
  const title = hatchLine(id);
  pushLog(next, id, title, "milestone");
  next.milestones.push({ id: `${id}-hatch`, homieId: id, at: next.gameMinute, title });
  next.activeId = id;
  return next;
}

export function describe(save: Save, id: HomieId) {
  bindProfiles(save.homies);
  const h = save.homies[id];
  const c = clock(save.gameMinute);
  const night = isNight(id, c.hour);
  const working = h.hatchedAt != null && isWorking(id, h.stage, c.hour, h.sleeping);
  const dayIndex = Math.floor(save.gameMinute / DAY);
  const food = cravingOf(id, dayIndex);
  return {
    clock: c,
    line: statusLine(id, h, c.hour, c.label, working, h.sleeping ? night : false, food.name),
    food,
    working,
    night,
  };
}

export function makeRecap(save: Save, id: HomieId, minGap: number): Recap | null {
  bindProfiles(save.homies);
  const h = save.homies[id];
  if (!h || h.hatchedAt == null) return null;
  const gap = save.gameMinute - h.lastViewed;
  if (gap < minGap) return null;
  const logs = save.log.filter((l) => l.homieId === id && l.at > h.lastViewed && l.kind !== "care");
  if (logs.length === 0 && gap < 180) return null;
  const bits = logs.slice(-4).map((l) => l.text);
  const food = cravingOf(id, Math.floor(save.gameMinute / DAY));
  if (h.stats.hunger < 60) bits.push(`${nameOf(id)} wants ${food.name.toLowerCase()}.`);
  const urgent = urgentLine(id, h);
  if (urgent) bits.unshift(urgent);
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const bit of bits) {
    if (seen.has(bit)) continue;
    seen.add(bit);
    lines.push(bit);
    if (lines.length === 4) break;
  }
  if (lines.length === 0) lines.push(`${nameOf(id)} had a quiet stretch. They're still here.`);
  const hour = clock(save.gameMinute).hour;
  const title = hour >= 5 && hour < 11 ? "Good morning" : hour >= 18 || hour < 5 ? "Welcome back" : "While you were out";
  return { homieId: id, title, lines };
}

export function traitsFrom(descriptors: string[]): Traits {
  const has = (word: string) => descriptors.some((item) => item.toLowerCase() === word);
  return {
    diet: has("impulsive") ? 38 : 56,
    playful: has("social") || has("impulsive") || has("bold") ? 70 : has("shy") || has("grumpy") ? 34 : 52,
    bond: has("kind") || has("gentle") ? 62 : has("grumpy") ? 34 : 46,
    grit: has("stubborn") ? 74 : has("lazy") ? 30 : 50,
  };
}

export function adoptHomie(save: Save, profile: CustomProfile, stage: Stage): Save {
  const next = structuredClone(save);
  const offset = STAGE_AT.find((row) => row.stage === stage)?.hours ?? 0;
  const id = `c${Math.random().toString(36).slice(2, 8)}`;
  const shaped = structuredClone(profile);
  shaped.milestones = shaped.milestones.map((mark) => ({ ...mark, minHours: mark.minHours + offset }));
  const homie = blank("tony");
  homie.traits = traitsFrom(shaped.descriptors);
  homie.stats = {
    hunger: 62,
    rest: 78,
    happiness: 74,
    cleanliness: 90,
    energy: 76,
    affection: 64,
    health: 94,
    fun: 68,
  };
  homie.stage = stage;
  homie.stageOffsetHours = offset;
  homie.profile = shaped;
  homie.hatchedAt = next.gameMinute;
  homie.lastViewed = next.gameMinute;
  homie.sleeping = false;
  homie.wakeAt = null;
  homie.sick = false;
  homie.noted = {};
  next.homies[id] = homie;
  next.order = [...HOMIE_IDS.filter((item) => next.homies[item]), ...next.order.filter((item) => !isBuiltin(item) && item !== id), id];
  bindProfiles(next.homies);
  const title = shaped.hatch;
  pushLog(next, id, title, "milestone");
  next.milestones.push({ id: `${id}-hatch`, homieId: id, at: next.gameMinute, title });
  next.activeId = id;
  return next;
}

export function releaseHomie(save: Save, id: HomieId): Save {
  if (isBuiltin(id) || !save.homies[id]) return save;
  if (Object.keys(save.homies).length < 2) return save;
  const next = structuredClone(save);
  delete next.homies[id];
  next.order = next.order.filter((item) => item !== id);
  next.log = next.log.filter((entry) => entry.homieId !== id);
  next.milestones = next.milestones.filter((mark) => mark.homieId !== id);
  if (next.activeId === id) next.activeId = next.order.find((item) => next.homies[item]) ?? Object.keys(next.homies)[0];
  bindProfiles(next.homies);
  return next;
}

export function restoreHomie(save: Save, id: string, profile: CustomProfile, stage: Stage): Save {
  if (!/^c[a-z0-9]{4,16}$/.test(id) || isBuiltin(id) || save.homies[id]) return save;
  const made = Object.keys(save.homies).filter((item) => item.startsWith("c")).length;
  if (made >= 4) return save;
  const coerced = coerceStoredProfile(profile);
  if (!coerced) return save;
  const next = structuredClone(save);
  const offset = STAGE_AT.find((row) => row.stage === stage)?.hours ?? 0;
  const shaped = structuredClone(coerced);
  shaped.milestones = shaped.milestones.map((mark) => ({ ...mark, minHours: mark.minHours + offset }));
  const homie = blank("tony");
  homie.traits = traitsFrom(shaped.descriptors);
  homie.stats = {
    hunger: 62,
    rest: 78,
    happiness: 74,
    cleanliness: 90,
    energy: 76,
    affection: 64,
    health: 94,
    fun: 68,
  };
  homie.stage = STAGES.includes(stage) ? stage : "adult";
  homie.stageOffsetHours = offset;
  homie.profile = shaped;
  homie.hatchedAt = next.gameMinute;
  homie.lastViewed = next.gameMinute;
  next.homies[id] = homie;
  const customs = next.order.filter((item) => !isBuiltin(item) && item !== id);
  next.order = [...HOMIE_IDS.filter((item) => next.homies[item]), ...customs, id];
  bindProfiles(next.homies);
  const title = shaped.hatch;
  pushLog(next, id, title, "milestone");
  next.milestones.push({ id: `${id}-back`, homieId: id, at: next.gameMinute, title });
  return next;
}

export { KEY as SAVE_KEY };
