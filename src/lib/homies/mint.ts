// Template-only port of homies' src/game/mint.ts: turns a few facts into a full CustomProfile.
// The original optionally asks an LLM to write the sheet; Clique uses the deterministic template
// so creation works offline and costs nothing. (sheetFromModel is ported and can be wired later.)
import { DESCRIPTORS, cleanName, clip, templateSheet, type MintFacts } from './engine/sheet';
import type { CustomProfile, Stage } from './engine/types';
import { STAGES } from './engine/types';

export const LOOKS = ['tony', 'betty', 'nori'] as const;
export type Look = (typeof LOOKS)[number];
export { DESCRIPTORS };

export type MintInput = {
  name: string;
  descriptors: string[];
  home: string;
  days: string;
  habit: string;
  stage: Stage;
  look: Look;
  neighbors?: string[];
};

export function mintFacts(input: MintInput): MintFacts {
  const allowed = new Set<string>(DESCRIPTORS);
  return {
    name: cleanName(input.name),
    descriptors: input.descriptors.filter((d) => allowed.has(d)).slice(0, 5),
    home: clip(input.home, 80) || 'Home',
    days: clip(input.days, 80) || 'Their days',
    habit: clip(input.habit, 80) || 'They keep a private habit.',
    stage: STAGES.includes(input.stage) ? input.stage : 'baby',
    neighbors: (input.neighbors ?? []).map((n) => cleanName(n)).filter(Boolean).slice(0, 4),
  };
}

export function mintProfile(input: MintInput): CustomProfile | null {
  const facts = mintFacts(input);
  if (!facts.name) return null;
  const sheet = templateSheet(facts);
  const look: Look = (LOOKS as readonly string[]).includes(input.look) ? input.look : 'tony';
  sheet.portrait = `/homies/${look}-{stage}.png`;
  return sheet;
}
