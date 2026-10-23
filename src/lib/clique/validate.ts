import type { Privacy } from './types';

export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
/** Static /mehspace/* segments: a username like these would be shadowed by the route. */
export const RESERVED_USERNAMES = ['edit', 'device', 'homie', 'circle'];
const PRIVACY: Privacy[] = ['public', 'friends', 'private'];

export interface ProfileInput {
  username: string;
  display_name: string;
  bio: string;
  status: string;
  privacy: Privacy;
}

export type FieldErrors = Partial<Record<keyof ProfileInput, string>>;

/** Mirrors the SQL check constraints on clique_profiles so users get friendly errors first. */
export function parseProfileInput(form: FormData | Record<string, unknown>): { input: ProfileInput; errors: FieldErrors } {
  const get = (k: string) => {
    const v = form instanceof FormData ? form.get(k) : form[k];
    return typeof v === 'string' ? v : '';
  };
  const input: ProfileInput = {
    username: get('username').trim().toLowerCase().replace(/^@/, ''),
    display_name: get('display_name').trim(),
    bio: get('bio').trim(),
    status: get('status').trim(),
    privacy: (PRIVACY.includes(get('privacy') as Privacy) ? get('privacy') : 'friends') as Privacy,
  };
  const errors: FieldErrors = {};
  if (!USERNAME_RE.test(input.username)) errors.username = '3–24 characters: lowercase letters, numbers, underscores.';
  else if (RESERVED_USERNAMES.includes(input.username)) errors.username = 'That username is reserved.';
  if (input.display_name.length < 1 || input.display_name.length > 60) errors.display_name = 'Display name is required (max 60).';
  if (input.bio.length > 500) errors.bio = 'Bio is max 500 characters.';
  if (input.status.length > 80) errors.status = 'Status is max 80 characters.';
  return { input, errors };
}

/** Turn arbitrary text (e.g. an email local part) into a valid username candidate. */
export function toUsernameCandidate(raw: string): string {
  const base = raw.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
  return base.length >= 3 ? base : (base + '_homie').slice(0, 24);
}
