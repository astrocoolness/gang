// Client-safe constants for Homie forms (no engine imports).
import type { HomieKind } from '@/lib/clique/types';

export const FACES = ['😎', '🦊', '🐸', '👽', '🤖', '🐱', '💀', '🌞', '🐶', '🐼', '🦄', '🌵'];
export const KINDS: { kind: HomieKind; label: string; blurb: string }[] = [
  { kind: 'avatar', label: 'Your avatar', blurb: 'The Homie that is you. One per person; it shows on your profile.' },
  { kind: 'pet', label: 'A pet to raise', blurb: 'Feed it, play, put it to bed. It grows from baby to elder, and friends can help.' },
  { kind: 'friend_page', label: 'A page for a friend', blurb: 'Make a Homie of someone you know, then send them a claim code so it becomes theirs.' },
];
export const SPECIES_OPTIONS = [
  { id: 'tony', label: 'Tony', blurb: 'Lazy, social, impulsive. Will want pancakes.' },
  { id: 'betty', label: 'Betty', blurb: 'Kind and stubborn. The garden answers to her.' },
  { id: 'nori', label: 'Nori', blurb: 'Curious, strange, barely sleeps.' },
  { id: 'custom', label: 'Make your own', blurb: 'Name it, pick its vibe, give it a home.' },
] as const;
export const STAGE_OPTIONS = ['baby', 'kid', 'teen', 'adult', 'elder'] as const;
export const DESCRIPTOR_OPTIONS = ['Lazy', 'Social', 'Impulsive', 'Kind', 'Stubborn', 'Curious', 'Strange', 'Gentle', 'Bold', 'Shy', 'Grumpy', 'Dreamy'] as const;
export const LOOK_OPTIONS = ['tony', 'betty', 'nori'] as const;
export const VISIBILITY_OPTIONS = [
  { id: 'friends', label: 'Friends' },
  { id: 'public', label: 'Everyone' },
  { id: 'private', label: 'Only me' },
] as const;
