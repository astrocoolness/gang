// Ported from astrocoolness/homies@b55a357 src/game/types.ts (plain TS, no framework deps).
export const HOMIE_IDS = ["tony", "betty", "nori"] as const;
export type BuiltinId = (typeof HOMIE_IDS)[number];
export type HomieId = string;

export const STAGES = ["baby", "kid", "teen", "adult", "elder"] as const;
export type Stage = (typeof STAGES)[number];

export const STAT_KEYS = [
  "hunger",
  "rest",
  "happiness",
  "cleanliness",
  "energy",
  "affection",
  "health",
  "fun",
] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export type Traits = {
  diet: number;
  playful: number;
  bond: number;
  grit: number;
};

export type Noted = Partial<Record<StatKey | "sick", boolean>>;

export type FoodKind = "fav" | "meal" | "junk";

export type FoodIcon = "cake" | "utensils" | "pizza" | "soup" | "star" | "battery" | "zap";

export type Food = {
  id: string;
  name: string;
  blurb: string;
  kind: FoodKind;
  icon: FoodIcon;
};

export type Pace = "slow" | "steady" | "wired";

export type NeedKey = "hunger" | "rest" | "cleanliness" | "fun" | "energy" | "affection";

export type CustomProfile = {
  name: string;
  descriptors: string[];
  homeTitle: string;
  homeLine: string;
  messy: string;
  tidy: string;
  job: string;
  bio: string;
  pace: Pace;
  foods: Food[];
  schedule: { bed: number; wake: number; work: [number, number] };
  portrait: string;
  hatch: string;
  sleep: string;
  nap: string;
  collapse: string;
  slip: string;
  sick: string;
  well: string;
  wakeEarly: string;
  wakeOk: string;
  work: string;
  medicine: string;
  quips: string[];
  beats: string[];
  talk: string[];
  talkAsleep: string;
  play: string;
  clean: string;
  feed: string;
  needs: Record<NeedKey, string>;
  stages: Record<Stage, string>;
  milestones: { id: string; title: string; minHours: number }[];
};

export type HomieState = {
  hatchedAt: number | null;
  sleeping: boolean;
  wakeAt: number | null;
  sick: boolean;
  stage: Stage;
  stageOffsetHours: number;
  stats: Stats;
  traits: Traits;
  noted: Noted;
  beatCooldown: number;
  lastBeatId: string;
  lastViewed: number;
  profile: CustomProfile | null;
};

export type LogKind = "life" | "care" | "milestone";

export type LogEntry = {
  id: string;
  homieId: HomieId;
  at: number;
  text: string;
  kind: LogKind;
};

export type MilestoneRecord = {
  id: string;
  homieId: HomieId;
  at: number;
  title: string;
};

export const SAVE_VERSION = 2;

export type Save = {
  version: number;
  originMs: number;
  lastWallMs: number;
  gameMinute: number;
  activeId: HomieId;
  muted: boolean;
  order: HomieId[];
  homies: Record<string, HomieState>;
  log: LogEntry[];
  milestones: MilestoneRecord[];
};

export type View = "care" | "episode" | "home" | "life";

export type Action = "feed" | "play" | "clean" | "talk" | "sleep" | "wake" | "medicine";

export type Sound =
  | "feed"
  | "play"
  | "clean"
  | "talk"
  | "sleep"
  | "wake"
  | "med"
  | "hatch"
  | "tap"
  | "no";

export type Recap = {
  homieId: HomieId;
  title: string;
  lines: string[];
};

export type BeatCtx = {
  id: HomieId;
  name: string;
  stage: Stage;
  hour: number;
  minuteLabel: string;
  stats: Stats;
  traits: Traits;
  others: HomieId[];
  lifeDay: number;
};
