import Image from 'next/image';
import { asset } from '@/lib/homies/asset';
import type { CliqueHomie } from '@/lib/clique/types';

/** Portrait for pets with a sim (Tony/Betty/Nori art), emoji face otherwise. */
export default function HomieAvatar({ homie, portrait, size = 56 }: { homie: Pick<CliqueHomie, 'face' | 'name' | 'kind' | 'stage'>; portrait?: string | null; size?: number }) {
  const src = portrait && portrait.startsWith('/homies/') ? asset(portrait) : null;
  if (src) {
    return (
      <Image src={src} alt={homie.name} width={size} height={size}
        className="rounded-full bg-[#1e1e2a] object-cover shrink-0" style={{ width: size, height: size }} />
    );
  }
  return (
    <div className="flex items-center justify-center rounded-full bg-[#1e1e2a] shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.55 }} aria-label={homie.name}>
      {homie.face || '🙂'}
    </div>
  );
}

export function portraitFor(h: Pick<CliqueHomie, 'kind' | 'stage' | 'profile'>): string | null {
  if (h.kind !== 'pet') return null;
  const species = h.profile?.species;
  const sim = h.profile?.sim as { engineId?: string; save?: { homies?: Record<string, { profile?: { portrait?: string } }> } } | undefined;
  const custom = sim?.engineId ? sim.save?.homies?.[sim.engineId]?.profile?.portrait : undefined;
  const stage = h.stage === 'egg' ? 'baby' : h.stage;
  if (typeof custom === 'string' && custom.includes('{stage}')) return custom.replaceAll('{stage}', stage);
  if (species === 'tony' || species === 'betty' || species === 'nori') return `/homies/${species}-${stage}.png`;
  return null;
}

export const KIND_LABEL: Record<CliqueHomie['kind'], string> = { avatar: 'Avatar', pet: 'Pet', friend_page: 'Friend page' };
