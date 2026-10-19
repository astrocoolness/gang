-- Clique Phase 2 / 7 of 7: Storage buckets + policies.
--
-- clique-chat  (private): Dial picture messages. Path: {thread_id}/{user_id}/{file}
--   read: thread members; write: your own folder inside a thread you belong to.
-- clique-media (private): avatars, homie portraits, reels, Mehspace/post images.
--   Path: {user_id}/{avatars|homies|reels|mehspace|posts}/{file}
--   read: anyone who can see that user (clique_can_see_user); write: your own folder.
-- Clients display images via createSignedUrl (select policy applies). No public buckets.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('clique-chat', 'clique-chat', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']),
  ('clique-media', 'clique-media', false, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'video/mp4', 'video/webm', 'audio/mpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists clique_chat_read on storage.objects;
create policy clique_chat_read on storage.objects
  for select to authenticated using (
    bucket_id = 'clique-chat'
    and public.clique_is_thread_member(public.clique_try_uuid((storage.foldername(name))[1]))
  );
drop policy if exists clique_chat_insert on storage.objects;
create policy clique_chat_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'clique-chat'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.clique_is_thread_member(public.clique_try_uuid((storage.foldername(name))[1]))
  );
drop policy if exists clique_chat_delete on storage.objects;
create policy clique_chat_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'clique-chat' and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists clique_media_read on storage.objects;
create policy clique_media_read on storage.objects
  for select to authenticated using (
    bucket_id = 'clique-media'
    and public.clique_can_see_user(public.clique_try_uuid((storage.foldername(name))[1]))
  );
drop policy if exists clique_media_insert on storage.objects;
create policy clique_media_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'clique-media' and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists clique_media_update on storage.objects;
create policy clique_media_update on storage.objects
  for update to authenticated
  using (bucket_id = 'clique-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'clique-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists clique_media_delete on storage.objects;
create policy clique_media_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'clique-media' and (storage.foldername(name))[1] = auth.uid()::text
  );
