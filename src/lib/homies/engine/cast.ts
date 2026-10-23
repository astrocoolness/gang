// Ported from astrocoolness/homies@b55a357 src/game/cast.ts (plain TS, no framework deps).
import { DESCRIPTORS, templateSheet } from "./sheet";
import type { CustomProfile, Food, FoodIcon, Stage } from "./types";

export const CAST_COUNT = 240;

const CLASH: [string, string][] = [
  ["Shy", "Social"],
  ["Grumpy", "Gentle"],
  ["Lazy", "Bold"],
];

const STARTS = [
  "Ada", "Al", "An", "Ari", "Ash", "Bea", "Bo", "Bram", "Cal", "Cas", "Cor", "Da", "Del", "Do", "Ed", "El", "Em", "En",
  "Fa", "Fen", "Fi", "Flo", "Ga", "Gil", "Ha", "Hal", "Id", "In", "Ira", "Jo", "Jun", "Ka", "Ke", "Kit", "La", "Le", "Lin",
  "Lo", "Lu", "Ma", "Mar", "Mi", "Mo", "Na", "Ne", "No", "Ny", "Or", "Os", "Pa", "Per", "Pi", "Qu", "Ra", "Ren", "Ri", "Ro",
  "Sa", "Sel", "Sha", "So", "Ta", "Te", "To", "Um", "Va", "Vi", "Wen", "Wy", "Ya", "Yu", "Ze", "Zo", "Bri", "Nico", "Rem",
];
const ENDS = ["a", "e", "i", "o", "n", "y", "ie", "en", "el", "is", "ey"];

const HOMES: { title: string; line: string }[] = [
  { title: "Corner bakery", line: "They sleep behind the ovens. Mornings arrive already warm." },
  { title: "Greenhouse flat", line: "More glass than wall, and one chair that knows its job." },
  { title: "Night bus yard", line: "A room that smells like rain and tickets." },
  { title: "Radio shop", line: "Dials click in the dark. Someone is always almost tuned in." },
  { title: "Library attic", line: "Dust, a skylight, and a rule about whispering." },
  { title: "Pier shed", line: "Weather comes in sideways. The kettle still works." },
  { title: "Bingo hall", line: "They live past the folding chairs and the lucky balls." },
  { title: "Clock stair", line: "A landing with a bed, halfway to the bells." },
  { title: "Moon motel", line: "A rented room that only feels real after midnight." },
  { title: "Garden cottage", line: "A small kitchen and a yard that argues back." },
  { title: "Cargo crate", line: "A converted crate, a good lamp, and a door that sticks." },
  { title: "Laundromat loft", line: "Warm vents, a round window, and other people's socks." },
  { title: "Ticket booth", line: "A stool, a bell, and a window onto the evening." },
  { title: "Ferry cabin", line: "The floor remembers waves. The bed does not mind." },
  { title: "Soup stall", line: "Steam on the glass, and a stool that is always warm." },
  { title: "Record nook", line: "Sleeves, a soft lamp, and a song that never quite ends." },
  { title: "Roof garden", line: "Wind, one chair, and a view of other people's kitchens." },
  { title: "Basement lab", line: "A quiet hum and a lamp that thinks it is the sun." },
  { title: "Flower stall", line: "Buckets, twine, and a bell that rings when it is windy." },
  { title: "Kettle house", line: "The kettle is the clock. Everything else is optional." },
  { title: "Map room", line: "Paper on every wall, and a pencil that goes missing." },
  { title: "Porch light", line: "A swing, moths, and a step that knows their weight." },
  { title: "Button shop", line: "Drawers of buttons and a counter the height of a secret." },
  { title: "Lighthouse stair", line: "A spiral, a cot, and a lamp that is somebody's job." },
];

const JOBS = [
  "bakes the morning bread",
  "names plants that refuse to flower",
  "drives the night bus",
  "fixes radios nobody admits they use",
  "writes fortunes that are often wrong",
  "walks dogs with strong opinions",
  "stacks chairs after bingo",
  "delivers letters that were never stamped",
  "translates dreams for one cookie",
  "teaches kids how to whistle",
  "keeps score at a tiny bowling alley",
  "sells umbrellas, mostly when it is sunny",
  "tunes pianos in empty rooms",
  "guards a pool in the off season",
  "runs a lost-and-found",
  "mends coats that aren't theirs",
  "sorts mail that arrived late",
  "paints signs nobody ordered",
  "feeds the neighborhood cat",
  "keeps a lighthouse lamp",
  "shelves books by feeling",
  "makes soup for the night shift",
  "winds clocks that still work",
  "collects buttons with stories",
  "sells cuttings from a folding table",
  "maps shortcuts that aren't shorter",
];

const HABITS = [
  "saves the last bite for nobody",
  "talks to the kettle like it has shift notes",
  "bows slightly to buses",
  "hums four notes before answering",
  "writes the day on a scrap and pockets it",
  "wears one loud sock as a policy",
  "counts ceiling tiles when a feeling gets big",
  "checks the lock twice and the window once",
  "apologizes to furniture they bump",
  "lines up shoes by how honest they feel",
  "keeps a stone that is not lucky, just familiar",
  "names every plant and then forgets on purpose",
  "pockets one button a day",
  "waits for the kettle to speak first",
  "leaves the window open a crack",
  "taps the lamp twice before bed",
  "saves a chair for someone who isn't coming",
  "says goodnight to the door",
  "folds the paper the wrong way on purpose",
  "keeps the good spoon in a drawer of its own",
];

const FOODS: { name: string; blurb: string; icon: FoodIcon }[] = [
  { name: "Honey toast", blurb: "The right kind of sweet.", icon: "cake" },
  { name: "Tomato soup", blurb: "From a pot that knows them.", icon: "soup" },
  { name: "Gas-station slice", blurb: "It folds like a secret.", icon: "pizza" },
  { name: "Noodle bowl", blurb: "Steam first, then the day.", icon: "soup" },
  { name: "Bean plate", blurb: "Serious food, no speech.", icon: "utensils" },
  { name: "Cinnamon milk", blurb: "A small ceremony.", icon: "battery" },
  { name: "Star sugar", blurb: "Mostly joy. A little light.", icon: "star" },
  { name: "Roast plate", blurb: "The good leftovers.", icon: "utensils" },
  { name: "Wrapped cake", blurb: "A prize, sort of.", icon: "cake" },
  { name: "Rice and egg", blurb: "Enough, which is the point.", icon: "utensils" },
  { name: "Corner fries", blurb: "Salt as a personality.", icon: "pizza" },
  { name: "Static crisps", blurb: "They crackle on the way down.", icon: "zap" },
];

const STYLES = ["tony", "betty", "nori"] as const;

export function originalStylePortrait(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i += 1) n = (n + id.charCodeAt(i)) % STYLES.length;
  return `/homies/${STYLES[n]}-{stage}.png`;
}

type Rng = () => number;

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(bag: T[], rng: Rng): T {
  return bag[Math.floor(rng() * bag.length)]!;
}

function namesFor(count: number) {
  const used = new Set<string>(["tony", "betty", "nori"]);
  const names: string[] = [];
  for (const start of STARTS) {
    const ends = start.length >= 4 ? ["a", "e", "i", "o", "n", "y"] : ENDS;
    for (const end of ends) {
      const name = `${start}${end}`;
      const key = name.toLowerCase();
      if (name.length < 3 || name.length > 12 || used.has(key)) continue;
      if (!/^[A-Za-z]+$/.test(name)) continue;
      used.add(key);
      names.push(name);
      if (names.length === count) return names;
    }
  }
  return names;
}

const NAMES = namesFor(CAST_COUNT + 40);

function descriptors(rng: Rng) {
  const bag = [...DESCRIPTORS];
  const out: string[] = [];
  while (out.length < 3 && bag.length > 0) {
    const next = bag.splice(Math.floor(rng() * bag.length), 1)[0];
    if (!next) break;
    if (out.some((have) => CLASH.some(([a, b]) => (have === a && next === b) || (have === b && next === a)))) continue;
    out.push(next);
  }
  while (out.length < 3) {
    const extra = DESCRIPTORS.find((item) => !out.includes(item));
    if (!extra) break;
    out.push(extra);
  }
  return out;
}

function menu(rng: Rng): Food[] {
  const bag = [...FOODS];
  const picked: typeof FOODS = [];
  while (picked.length < 3 && bag.length > 0) picked.push(bag.splice(Math.floor(rng() * bag.length), 1)[0]!);
  const kinds = ["fav", "meal", "junk"] as const;
  return picked.map((food, index) => ({
    id: kinds[index]!,
    name: food.name,
    blurb: food.blurb,
    kind: kinds[index]!,
    icon: food.icon,
  }));
}

function cap(line: string) {
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}`;
}

function buildOne(id: string, name: string, rng: Rng): { id: string; profile: CustomProfile } {
  const traits = descriptors(rng);
  const home = pick(HOMES, rng);
  const job = pick(JOBS, rng);
  const habit = pick(HABITS, rng);
  const stage: Stage = "baby";
  const sheet = templateSheet({
    name,
    descriptors: traits,
    home: home.title,
    days: job,
    habit,
    stage,
    neighbors: [],
  });
  sheet.foods = menu(rng);
  sheet.homeTitle = home.title;
  sheet.homeLine = home.line;
  sheet.job = job;
  sheet.bio = `${traits.join(", ")}. ${cap(job)}.`;
  sheet.hatch = `${name} is here. ${cap(habit)}.`;
  sheet.work = `${name} is out. ${cap(job)}.`;
  sheet.talk = [
    `You can stay. I was in the middle of ${habit}.`,
    `Today was ${job}. I saved you the part that didn't fit.`,
    habit,
    `Don't ask me to explain ${home.title.toLowerCase()}. It explains itself.`,
    "I saved you the good part of the day.",
  ];
  sheet.quips = [
    `${name} is doing it again: ${habit}.`,
    `${name} hums something from ${home.title.toLowerCase()}.`,
    `${cap(job)}. ${name} keeps an eye on it.`,
    `${name} has nowhere urgent to be, and is going anyway.`,
    `${name} kept a thought for later.`,
    `${name} checks ${home.title.toLowerCase()} like it might have news.`,
  ];
  const bed = traits.includes("Lazy") || traits.includes("Dreamy") ? 23 : traits.includes("Curious") ? 1 : 22;
  const wake = traits.includes("Lazy") ? 10 : traits.includes("Gentle") ? 6 : 8;
  sheet.schedule = { bed, wake, work: traits.includes("Lazy") ? [12, 18] : [9, 16] };
  sheet.pace =
    traits.includes("Lazy") || traits.includes("Gentle")
      ? "slow"
      : traits.includes("Curious") || traits.includes("Impulsive") || traits.includes("Strange")
        ? "wired"
        : "steady";
  sheet.portrait = originalStylePortrait(id);
  return { id, profile: sheet };
}

function buildCatalog() {
  const rng = mulberry32(0xc45e240);
  const cast: { id: string; profile: CustomProfile }[] = [];
  for (let i = 0; i < CAST_COUNT; i += 1) {
    const id = `g${i.toString(16).padStart(8, "0")}`;
    const name = NAMES[i] ?? `Homie ${i + 1}`;
    cast.push(buildOne(id, name, rng));
  }
  return cast;
}

const CATALOG = buildCatalog();
const CATALOG_IDS = new Set(CATALOG.map((homie) => homie.id));

export function isCatalogId(id: string) {
  return CATALOG_IDS.has(id);
}

function mention(profile: CustomProfile, other: string): CustomProfile {
  return {
    ...profile,
    quips: profile.quips.map((line, index) => (index === 4 ? `${profile.name} thought about ${other} and didn't say why.` : line)),
  };
}

export function rollStarters() {
  const first = Math.floor(Math.random() * CATALOG.length);
  let second = Math.floor(Math.random() * (CATALOG.length - 1));
  if (second >= first) second += 1;
  const a = CATALOG[first]!;
  const b = CATALOG[second]!;
  return [
    { id: a.id, profile: mention(structuredClone(a.profile), b.profile.name) },
    { id: b.id, profile: mention(structuredClone(b.profile), a.profile.name) },
  ];
}
