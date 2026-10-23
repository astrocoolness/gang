// Ported from astrocoolness/homies@b55a357 src/game/sheet.ts (plain TS, no framework deps).
import type { CustomProfile, Food, FoodIcon, FoodKind, NeedKey, Pace, Stage } from "./types";
import { STAGES } from "./types";

export const DESCRIPTORS = [
  "Lazy",
  "Social",
  "Impulsive",
  "Kind",
  "Stubborn",
  "Curious",
  "Strange",
  "Gentle",
  "Bold",
  "Shy",
  "Grumpy",
  "Dreamy",
] as const;

export type MintFacts = {
  name: string;
  descriptors: string[];
  home: string;
  days: string;
  habit: string;
  stage: Stage;
  neighbors: string[];
};

const ICONS = new Set<FoodIcon>(["cake", "utensils", "pizza", "soup", "star", "battery", "zap"]);
const KINDS = new Set<FoodKind>(["fav", "meal", "junk"]);
const PACES = new Set<Pace>(["slow", "steady", "wired"]);

export function clip(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function cleanName(value: unknown) {
  const name = clip(value, 16).replace(/[^A-Za-z0-9' -]/g, "");
  return name.slice(0, 16);
}

function lines(value: unknown, count: number, fallback: string) {
  const list = Array.isArray(value) ? value.map((item) => clip(item, 180)).filter(Boolean) : [];
  while (list.length < count) list.push(fallback);
  return list.slice(0, count);
}

function hour(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 23) return fallback;
  return n;
}

export function templateSheet(facts: MintFacts): CustomProfile {
  const name = facts.name;
  const home = facts.home;
  const days = facts.days;
  const habit = facts.habit;
  const desc = facts.descriptors.join(", ").toLowerCase();
  const neighbor = facts.neighbors[0];
  const cameo = neighbor ? `${name} thought about ${neighbor} and didn't say why.` : `${name} kept a thought for later.`;
  return {
    name,
    descriptors: facts.descriptors,
    homeTitle: clip(home, 42),
    homeLine: `${name} lives here. ${habit}`,
    messy: `The place looks like ${name} left in a hurry.`,
    tidy: `${name} put it back, almost.`,
    job: clip(days, 80),
    bio: `${desc}. Days go to ${days.toLowerCase()}.`,
    pace: facts.descriptors.includes("Lazy") ? "slow" : facts.descriptors.includes("Curious") || facts.descriptors.includes("Strange") ? "wired" : "steady",
    foods: [
      { id: "fav", name: "The usual", blurb: `What ${name} actually wants.`, kind: "fav", icon: "star" },
      { id: "meal", name: "A real plate", blurb: "Enough for the day.", kind: "meal", icon: "utensils" },
      { id: "junk", name: "A bad idea", blurb: "They know. They eat it.", kind: "junk", icon: "pizza" },
    ],
    schedule: facts.descriptors.includes("Lazy")
      ? { bed: 23, wake: 9, work: [11, 17] }
      : { bed: 22, wake: 7, work: [9, 17] },
    portrait: "",
    hatch: `${name} moved in. ${habit}`,
    sleep: `${name} went to bed, still thinking about ${days.toLowerCase()}.`,
    nap: `${name} is napping and will deny it.`,
    collapse: `${name} fell asleep where they were.`,
    slip: `Days slipped past. ${name} kept the habit: ${habit.charAt(0).toLowerCase()}${habit.slice(1)}`,
    sick: `${name} isn't well, and is being quiet about it.`,
    well: `${name} looks like themself again.`,
    wakeEarly: `You woke ${name} early. They will remember.`,
    wakeOk: `${name} is up.`,
    work: `${name} is out: ${days.toLowerCase()}.`,
    medicine: `${name} took the medicine and made a face.`,
    quips: [
      `${name} is thinking about the day.`,
      habit,
      `${name} hums something from home.`,
      `${name} has nowhere urgent to be.`,
      cameo,
      `${name} checks the room like it might have news.`,
    ],
    beats: [
      `${name} spent an hour on ${days.toLowerCase()}.`,
      `${name} did it again: ${habit.charAt(0).toLowerCase()}${habit.slice(1)}`,
      `${name} came home and stood in the doorway a second too long.`,
      cameo,
      `${name} found something small and kept it.`,
      `${name} almost called someone, then didn't.`,
      `${name} ate standing up and called it a plan.`,
      `${name} had a strange dream about ${home.toLowerCase()}.`,
    ],
    talk: [
      "You can stay a minute.",
      `I've been ${days.charAt(0).toLowerCase()}${days.slice(1)}. It's a whole thing.`,
      habit,
      "I saved you the good part of the day.",
      "Don't fix it. Just be here.",
    ],
    talkAsleep: `You say their name. ${name} answers without waking.`,
    play: `You spent time with ${name}. ${habit}`,
    clean: `${name} got cleaned up and immediately found a new mess.`,
    feed: `${name} ate {food}.`,
    needs: {
      hunger: `${name} is hungry.`,
      rest: `${name} is sleepy.`,
      cleanliness: `${name} could use a wash.`,
      fun: `${name} is bored.`,
      energy: `${name} is worn out.`,
      affection: `${name} misses you.`,
    },
    stages: {
      baby: "",
      kid: `${name} isn't a baby anymore.`,
      teen: `${name} hit the age of opinions.`,
      adult: `${name} grew into ${days.toLowerCase()}.`,
      elder: `${name} got older, and more certain.`,
    },
    milestones: [
      { id: "habit", title: `${name} made it a habit: ${habit}`, minHours: 10 },
      { id: "days", title: `${name} started taking ${days.toLowerCase()} seriously.`, minHours: 36 },
      { id: "home", title: `${name} decided ${home.toLowerCase()} was really theirs.`, minHours: 80 },
    ],
  };
}

function foodsFrom(value: unknown, name: string): Food[] {
  const fallback = templateSheet({
    name,
    descriptors: [],
    home: "home",
    days: "their days",
    habit: "a private habit",
    stage: "adult",
    neighbors: [],
  }).foods;
  if (!Array.isArray(value)) return fallback;
  const foods: Food[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<Food>;
    const kind = KINDS.has(row.kind as FoodKind) ? (row.kind as FoodKind) : null;
    if (!kind) continue;
    const icon = ICONS.has(row.icon as FoodIcon) ? (row.icon as FoodIcon) : "utensils";
    const foodName = clip(row.name, 28);
    if (!foodName) continue;
    foods.push({
      id: kind,
      name: foodName,
      blurb: clip(row.blurb, 80) || "They'll eat it.",
      kind,
      icon,
    });
  }
  const byKind = new Map(foods.map((food) => [food.kind, food]));
  return (["fav", "meal", "junk"] as FoodKind[]).map((kind) => byKind.get(kind) ?? fallback.find((food) => food.kind === kind)!);
}

export function sheetFromModel(raw: unknown, facts: MintFacts): CustomProfile {
  const base = templateSheet(facts);
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Record<string, unknown>;
  const schedule = (row.schedule ?? {}) as { bed?: unknown; wake?: unknown; work?: unknown };
  const work = Array.isArray(schedule.work) ? schedule.work : [9, 17];
  const pace = PACES.has(row.pace as Pace) ? (row.pace as Pace) : base.pace;
  const needsIn = (row.needs ?? {}) as Partial<Record<NeedKey, unknown>>;
  const needs = { ...base.needs };
  (Object.keys(needs) as NeedKey[]).forEach((key) => {
    const line = clip(needsIn[key], 140);
    if (line) needs[key] = line;
  });
  const stagesIn = (row.stages ?? {}) as Partial<Record<Stage, unknown>>;
  const stages = { ...base.stages };
  for (const stage of STAGES) {
    const line = clip(stagesIn[stage], 160);
    if (line) stages[stage] = stage === "baby" ? "" : line;
  }
  const milestonesIn = Array.isArray(row.milestones) ? row.milestones : [];
  const milestones = milestonesIn
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const title = clip((item as { title?: unknown }).title, 140);
      const minHours = Number((item as { minHours?: unknown }).minHours);
      if (!title || !Number.isFinite(minHours)) return null;
      return { id: `m${index}`, title, minHours: Math.max(4, Math.min(200, Math.round(minHours))) };
    })
    .filter((item): item is { id: string; title: string; minHours: number } => !!item)
    .slice(0, 4);
  return {
    ...base,
    homeTitle: clip(row.homeTitle, 42) || base.homeTitle,
    homeLine: clip(row.homeLine, 140) || base.homeLine,
    messy: clip(row.messy, 140) || base.messy,
    tidy: clip(row.tidy, 140) || base.tidy,
    job: clip(row.job, 80) || base.job,
    bio: clip(row.bio, 140) || base.bio,
    pace,
    foods: foodsFrom(row.foods, facts.name),
    schedule: {
      bed: hour(schedule.bed, base.schedule.bed),
      wake: hour(schedule.wake, base.schedule.wake),
      work: [hour(work[0], base.schedule.work[0]), hour(work[1], base.schedule.work[1])],
    },
    hatch: clip(row.hatch, 160) || base.hatch,
    sleep: clip(row.sleep, 160) || base.sleep,
    nap: clip(row.nap, 160) || base.nap,
    collapse: clip(row.collapse, 160) || base.collapse,
    slip: clip(row.slip, 160) || base.slip,
    sick: clip(row.sick, 160) || base.sick,
    well: clip(row.well, 160) || base.well,
    wakeEarly: clip(row.wakeEarly, 160) || base.wakeEarly,
    wakeOk: clip(row.wakeOk, 160) || base.wakeOk,
    work: clip(row.work, 160) || base.work,
    medicine: clip(row.medicine, 160) || base.medicine,
    quips: lines(row.quips, 6, base.quips[0]),
    beats: lines(row.beats, 8, base.beats[0]),
    talk: lines(row.talk, 5, base.talk[0]),
    talkAsleep: clip(row.talkAsleep, 160) || base.talkAsleep,
    play: clip(row.play, 160) || base.play,
    clean: clip(row.clean, 160) || base.clean,
    feed: (clip(row.feed, 160) || base.feed).includes("{food}") ? clip(row.feed, 160) || base.feed : `${facts.name} ate {food}.`,
    needs,
    stages,
    milestones: milestones.length >= 2 ? milestones : base.milestones,
  };
}

export function coerceStoredProfile(raw: unknown): CustomProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<CustomProfile>;
  const name = cleanName(row.name);
  const portrait = typeof row.portrait === "string" ? row.portrait : "";
  const dataPortrait = portrait.startsWith("data:image/") && portrait.length < 750_000;
  const shelfPortrait =
    portrait.startsWith("https://") &&
    portrait.length < 400 &&
    portrait.includes("/storage/v1/object/public/homie-files/");
  const stylePortrait = /^\/homies\/(tony|betty|nori)-\{stage\}\.png$/.test(portrait);
  if (!name || (!dataPortrait && !shelfPortrait && !stylePortrait)) return null;
  const facts: MintFacts = {
    name,
    descriptors: Array.isArray(row.descriptors) ? row.descriptors.map((item) => clip(item, 24)).filter(Boolean).slice(0, 6) : [],
    home: clip(row.homeTitle, 80) || "Home",
    days: clip(row.job, 80) || "their days",
    habit: clip(row.homeLine, 80) || "a private habit",
    stage: "adult",
    neighbors: [],
  };
  const sheet = sheetFromModel(row, facts);
  sheet.name = name;
  sheet.descriptors = facts.descriptors;
  sheet.portrait = portrait;
  return sheet;
}
