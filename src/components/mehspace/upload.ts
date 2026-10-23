'use client';

import { createClient } from '@/lib/supabase/client';

export const MEDIA_BUCKET = 'clique-media';
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'audio/mpeg': 'mp3' };

/** Browser upload straight to clique-media/{uid}/{folder}/ (storage RLS: your own folder only). */
export async function uploadMedia(userId: string, folder: 'mehspace' | 'posts', file: File, prefix = 'f') {
  const ext = EXT[file.type];
  if (!ext) throw new Error('Unsupported file type.');
  const limit = file.type === 'audio/mpeg' ? 20 : 8;
  if (file.size > limit * 1024 * 1024) throw new Error(`Files must be under ${limit} MB.`);
  const path = `${userId}/${folder}/${prefix}-${crypto.randomUUID()}.${ext}`;
  const { error } = await createClient().storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}
