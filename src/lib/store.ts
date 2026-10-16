'use client';

import { useCallback, useEffect, useState } from 'react';
import { Homie, MessPost, MessSpace } from '@/types';

/**
 * Browser-storage persistence for v1. Shapes match the Supabase data model
 * so this can be swapped for Supabase reads/writes later (see hq/specs/homies-spec.md).
 */
const KEY = 'gang:v1';

interface GangState {
  homies: Homie[];
  spaces: MessSpace[];
}

const empty: GangState = { homies: [], spaces: [] };

function load(): GangState {
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...empty, ...JSON.parse(raw) } : empty;
  } catch {
    return empty;
  }
}

function save(state: GangState) {
  window.localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new Event('gang:update'));
}

export function useGang() {
  const [state, setState] = useState<GangState>(empty);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setState(load());
    // Hydrate from localStorage (gang:v1) after mount, outside the effect body.
    const raf = window.requestAnimationFrame(() => {
      sync();
      setReady(true);
    });
    window.addEventListener('gang:update', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('gang:update', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = useCallback((fn: (s: GangState) => GangState) => {
    save(fn(load()));
  }, []);

  const createHomie = useCallback(
    (input: Pick<Homie, 'name' | 'face_url' | 'voice_id' | 'backstory' | 'interests'>) => {
      const now = new Date().toISOString();
      const homie: Homie = { ...input, id: crypto.randomUUID(), owner_id: 'local', attention: 100, created_at: now };
      const space: MessSpace = { id: crypto.randomUUID(), homie_id: homie.id, layout_json: { columns: 1 }, posts: [], theme: 'violet' };
      update((s) => ({ homies: [...s.homies, homie], spaces: [...s.spaces, space] }));
      return homie;
    },
    [update],
  );

  const setAttention = useCallback(
    (homieId: string, fn: (a: number) => number) =>
      update((s) => ({
        ...s,
        homies: s.homies.map((h) => (h.id === homieId ? { ...h, attention: Math.max(0, Math.min(100, fn(h.attention))) } : h)),
      })),
    [update],
  );

  const updateSpace = useCallback(
    (homieId: string, fn: (m: MessSpace) => MessSpace) =>
      update((s) => ({ ...s, spaces: s.spaces.map((m) => (m.homie_id === homieId ? fn(m) : m)) })),
    [update],
  );

  const deleteHomie = useCallback(
    (id: string) => update((s) => ({ homies: s.homies.filter((h) => h.id !== id), spaces: s.spaces.filter((m) => m.homie_id !== id) })),
    [update],
  );

  return { ...state, ready, createHomie, setAttention, updateSpace, deleteHomie };
}

export function newPost(authorId: string, body: string): MessPost {
  return { id: crypto.randomUUID(), author_homie_id: authorId, body, created_at: new Date().toISOString(), likes: [] };
}
