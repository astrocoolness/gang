// Form parsing for Homie create/edit. Mirrors clique_homies check constraints.
import type { HomieKind, Privacy } from '@/lib/clique/types';
import type { Stage } from './engine/types';
import { STAGES } from './engine/types';
import { DESCRIPTORS, LOOKS, type Look, type MintInput } from './mint';
import { isSpecies, type Species } from './sim';
import { FACES } from './constants';

export { FACES, KINDS } from './constants';
const PRIVACY: Privacy[] = ['public', 'friends', 'private'];

export type HomieFields = {
  name: string;
  face: string;
  backstory: string;
  interests: string[];
  visibility: Privacy;
};
export type CreateInput = HomieFields & { kind: HomieKind; species: Species | null; mint: MintInput | null; stage: Stage };
export type Errors = Partial<Record<'name' | 'kind' | 'species' | 'backstory' | 'interests' | 'form', string>>;

function getter(form: FormData) {
  return (k: string) => {
    const v = form.get(k);
    return typeof v === 'string' ? v.trim() : '';
  };
}

export function parseInterests(raw: string) {
  return [...new Set(raw.split(',').map((s) => s.trim().slice(0, 40)).filter(Boolean))].slice(0, 12);
}

export function parseFields(form: FormData): { fields: HomieFields; errors: Errors } {
  const get = getter(form);
  const face = get('face');
  const fields: HomieFields = {
    name: get('name').replace(/\s+/g, ' '),
    face: FACES.includes(face) ? face : FACES[0],
    backstory: get('backstory'),
    interests: parseInterests(get('interests')),
    visibility: (PRIVACY.includes(get('visibility') as Privacy) ? get('visibility') : 'friends') as Privacy,
  };
  const errors: Errors = {};
  if (fields.name.length < 1 || fields.name.length > 40) errors.name = 'Name needs 1–40 characters.';
  if (fields.backstory.length > 2000) errors.backstory = 'Keep it under 2000 characters.';
  return { fields, errors };
}

export function parseCreate(form: FormData): { input: CreateInput; errors: Errors } {
  const get = getter(form);
  const kind = get('kind') as HomieKind;
  const { fields, errors } = parseFields(form);
  const stage = (STAGES as readonly string[]).includes(get('stage')) ? (get('stage') as Stage) : 'baby';
  const input: CreateInput = { ...fields, kind, species: null, mint: null, stage };
  if (!['avatar', 'pet', 'friend_page'].includes(kind)) errors.kind = 'Pick what kind of Homie this is.';
  if (kind === 'pet') {
    const species = get('species');
    if (!isSpecies(species)) {
      errors.species = 'Pick Tony, Betty, Nori, or make your own.';
    } else {
      input.species = species;
      if (species === 'custom') {
        const look = (LOOKS as readonly string[]).includes(get('look')) ? (get('look') as Look) : 'tony';
        const allowed = new Set<string>(DESCRIPTORS);
        input.mint = {
          name: fields.name,
          descriptors: form.getAll('descriptors').filter((d): d is string => typeof d === 'string' && allowed.has(d)).slice(0, 5),
          home: get('home'), days: get('days'), habit: get('habit'), stage, look,
        };
        if (!/^[A-Za-z0-9' -]{1,16}$/.test(fields.name)) errors.name = 'Custom pets: up to 16 letters, numbers, spaces, apostrophes or dashes.';
      } else {
        // Built-ins keep their names; the field is ignored.
        delete errors.name;
        input.name = species.charAt(0).toUpperCase() + species.slice(1);
      }
    }
  }
  return { input, errors };
}
