'use server';

import { revalidatePath } from 'next/cache';
import {
  addBlurb, addPost, deleteBlurb, deletePost, FRAME_DEFAULT, FRAME_MAX, FRAME_MIN, rerender, saveBasics, saveCustom,
  saveMedia, saveTopFriends, toggleLike,
} from '@/lib/clique/mehspace';
import { frameDocument } from '@/lib/mehspace/frame';
import { MAX_CSS, MAX_HTML, renderMehspace, safeUrl } from '@/lib/mehspace/sanitize';
import { THEME_IDS, themeOf } from '@/lib/mehspace/themes';
import type { CliquePost, Privacy } from '@/lib/clique/types';

export type MehState = { status: 'idle' | 'ok' | 'error'; message?: string };
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v.trim() : '';
};
const raw = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
};
const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const list = (v: string) => [...new Set(v.split(',').map((x) => x.trim().slice(0, 40)).filter(Boolean))].slice(0, 20);
const done = (message: string): MehState => {
  revalidatePath('/mehspace', 'layout');
  revalidatePath('/');
  return { status: 'ok', message };
};
const fail = (message: string): MehState => ({ status: 'error', message });

export async function saveBasicsAction(_prev: MehState, fd: FormData): Promise<MehState> {
  const id = str(fd, 'id');
  if (!isId(id)) return fail('Missing Mehspace.');
  const title = str(fd, 'title');
  const mood = str(fd, 'mood');
  const about = str(fd, 'about');
  if (title.length > 80) return fail('Title is too long (80 max).');
  if (mood.length > 60) return fail('Mood is too long (60 max).');
  if (about.length > 5000) return fail('About is too long (5000 max).');
  const theme = str(fd, 'theme');
  const vis = str(fd, 'visibility');
  const songRaw = str(fd, 'song_url');
  const song = songRaw ? safeUrl(songRaw) : null;
  if (songRaw && (!song || song.length > 500)) return fail('Song link must be an https:// URL.');
  const h = Number(str(fd, 'frame_height'));
  const res = await saveBasics(id, {
    title, mood, about,
    interests: list(str(fd, 'interests')),
    heroes: list(str(fd, 'heroes')),
    theme: (THEME_IDS as string[]).includes(theme) ? theme : 'night',
    visibility: (['public', 'friends', 'private'].includes(vis) ? vis : 'friends') as Privacy,
    song_url: song,
    frame_height: Number.isFinite(h) && h > 0 ? Math.min(FRAME_MAX, Math.max(FRAME_MIN, Math.round(h))) : FRAME_DEFAULT,
  });
  return res.ok ? done('Saved.') : fail(res.error);
}

export async function saveTopAction(_prev: MehState, fd: FormData): Promise<MehState> {
  const id = str(fd, 'id');
  if (!isId(id)) return fail('Missing Mehspace.');
  const ids = fd.getAll('top').filter((v): v is string => typeof v === 'string' && isId(v));
  if (ids.length > 8) return fail('Top 8 means 8.');
  const res = await saveTopFriends(id, ids);
  return res.ok ? done('Top 8 saved.') : fail(res.error);
}

/** Called by the uploader after the browser has put the file in clique-media/{uid}/mehspace/. */
export async function saveMediaAction(spaceId: string, kind: 'song' | 'photo', path: string | null): Promise<MehState> {
  if (!isId(spaceId) || (kind !== 'song' && kind !== 'photo')) return fail('Bad request.');
  const res = await saveMedia(spaceId, kind, path);
  return res.ok ? done(path ? 'Uploaded.' : 'Removed.') : fail(res.error);
}

export async function saveCustomAction(_prev: MehState, fd: FormData): Promise<MehState> {
  const id = str(fd, 'id');
  if (!isId(id)) return fail('Missing Mehspace.');
  const html = raw(fd, 'custom_html');
  const css = raw(fd, 'custom_css');
  if (html.length > MAX_HTML || css.length > MAX_CSS) return fail('That’s too much code (100k HTML / 50k CSS max).');
  const res = await saveCustom(id, html, css);
  if (!res.ok) return fail(res.error);
  revalidatePath('/mehspace', 'layout');
  if (res.data.status === 'ok') return { status: 'ok', message: 'Published. Anything unsafe was stripped.' };
  if (res.data.status === 'rejected') return fail(`Saved, but not published: ${res.data.error}`);
  return { status: 'ok', message: res.data.error ?? 'Saved; waiting to publish.' };
}

export async function rerenderAction(fd: FormData) {
  const id = str(fd, 'id');
  if (!isId(id)) return;
  await rerender(id);
  revalidatePath('/mehspace', 'layout');
}

/** Editor preview: sanitize only, nothing stored. Same frame document as the live page. */
export async function previewAction(html: string, css: string, theme: string): Promise<{ doc: string; error?: string }> {
  if (typeof html !== 'string' || typeof css !== 'string' || html.length > MAX_HTML || css.length > MAX_CSS) {
    return { doc: '', error: 'That’s too much code (100k HTML / 50k CSS max).' };
  }
  const out = renderMehspace(html, css);
  const t = themeOf(typeof theme === 'string' ? theme : '');
  if (out.status !== 'ok') return { doc: '', error: out.error };
  return { doc: frameDocument(out.html, out.css, { ink: t.ink, accent: t.accent }) };
}

const MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
function parseMedia(json: string): CliquePost['media'] | null {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v) || v.length > 4) return null;
    const out: CliquePost['media'] = [];
    for (const m of v) {
      if (!m || typeof m.path !== 'string' || !MIMES.includes(m.mime)) return null;
      out.push({ path: m.path, mime: m.mime, alt: typeof m.alt === 'string' ? m.alt.slice(0, 300) : '' });
    }
    return out;
  } catch {
    return null;
  }
}

export async function addPostAction(_prev: MehState, fd: FormData): Promise<MehState> {
  const id = str(fd, 'space_id');
  if (!isId(id)) return fail('Missing Mehspace.');
  const body = str(fd, 'body');
  const media = parseMedia(str(fd, 'media'));
  if (!media) return fail('Posts can have up to 4 images.');
  if (body.length > 5000) return fail('That post is too long (5000 max).');
  if (!body && !media.length) return fail('Write something or add a picture.');
  const res = await addPost(id, body, media);
  return res.ok ? done('Posted.') : fail(res.error);
}

export async function addBlurbAction(_prev: MehState, fd: FormData): Promise<MehState> {
  const id = str(fd, 'space_id');
  if (!isId(id)) return fail('Missing Mehspace.');
  const body = str(fd, 'body');
  if (!body) return fail('Say something nice.');
  if (body.length > 1000) return fail('Blurbs are 1000 characters max.');
  const res = await addBlurb(id, body);
  return res.ok ? done('Blurb added.') : fail(res.error);
}

export async function toggleLikeAction(fd: FormData) {
  const id = str(fd, 'post_id');
  if (!isId(id)) return;
  await toggleLike(id);
  revalidatePath('/mehspace', 'layout');
}

export async function deletePostAction(fd: FormData) {
  const id = str(fd, 'post_id');
  if (!isId(id)) return;
  await deletePost(id);
  revalidatePath('/mehspace', 'layout');
}

export async function deleteBlurbAction(fd: FormData) {
  const id = str(fd, 'blurb_id');
  if (!isId(id)) return;
  await deleteBlurb(id);
  revalidatePath('/mehspace', 'layout');
}
