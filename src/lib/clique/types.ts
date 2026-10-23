/**
 * Row types for the Clique schema (supabase/migrations/20261019*). Hand-written to match the SQL;
 * replace with `supabase gen types typescript` output once the migrations are applied.
 */
export type Privacy = 'public' | 'friends' | 'private';
export type HomieKind = 'avatar' | 'pet' | 'friend_page';
export type HomieStage = 'egg' | 'baby' | 'kid' | 'teen' | 'adult' | 'elder';
export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';
export type CircleRole = 'owner' | 'admin' | 'member';
export type ThreadKind = 'dm' | 'group' | 'circle';
export type MessageKind = 'image' | 'text' | 'system';

export interface CliqueProfile {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  status: string;
  avatar_homie_id: string | null;
  avatar_path: string | null;
  privacy: Privacy;
  onboarded_at: string | null;
  legacy_source: string | null;
  legacy_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CliqueFriendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  blocked_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CliqueHomie {
  id: string;
  owner_id: string;
  kind: HomieKind;
  subject_user_id: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  claim_expires_at: string | null;
  name: string;
  face: string;
  portrait_path: string | null;
  voice_id: string;
  backstory: string;
  interests: string[];
  stage: HomieStage;
  stats: Record<string, number>;
  traits: unknown; // pets: engine Traits object; legacy rows may hold []
  profile: Record<string, unknown>;
  attention: number;
  visibility: Privacy;
  legacy_source: string | null;
  legacy_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HomieEventType =
  | 'created' | 'evolve' | 'episode' | 'reel' | 'care' | 'narrative' | 'claimed' | 'dial' | 'imported';

export interface CliqueHomieEvent {
  id: string;
  homie_id: string;
  actor_id: string | null;
  type: HomieEventType;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface CliqueInfluence {
  id: string;
  owner_id: string;
  title: string;
  kind: 'music' | 'book' | 'film' | 'art' | 'place' | 'person' | 'url' | 'other';
  url: string | null;
  notes: string;
  tags: string[];
  visibility: Privacy;
  created_at: string;
}

export interface CliqueMehspace {
  id: string;
  owner_type: 'user' | 'homie' | 'circle';
  user_id: string | null;
  homie_id: string | null;
  circle_id: string | null;
  title: string;
  theme: string;
  layout_json: Record<string, unknown>;
  song_url: string | null;
  mood: string;
  about: string;
  interests: string[];
  heroes: string[];
  top_friends: string[];
  custom_html: string;
  custom_css: string;
  /** Written only by the trusted sanitizer. Render inside a sandboxed iframe, never inline. */
  rendered_html: string | null;
  rendered_css: string | null;
  render_status: 'pending' | 'ok' | 'rejected';
  visibility: Privacy;
  created_at: string;
  updated_at: string;
}

export interface CliquePost {
  id: string;
  space_id: string;
  author_id: string;
  as_homie_id: string | null;
  body: string;
  media: { path: string; mime: string; width?: number; height?: number; alt?: string }[];
  created_at: string;
  updated_at: string;
}

export interface CliqueCircle {
  id: string;
  slug: string;
  name: string;
  description: string;
  kind: 'friends' | 'space' | 'community';
  visibility: 'public' | 'private';
  created_by: string;
  created_at: string;
}

export interface CliqueThread {
  id: string;
  kind: ThreadKind;
  circle_id: string | null;
  title: string;
  created_by: string | null;
  created_at: string;
  last_message_at: string | null;
}

export interface CliqueMessage {
  id: string;
  thread_id: string;
  sender_id: string | null;
  as_homie_id: string | null;
  kind: MessageKind;
  body: string;
  image_path: string | null;
  image_width: number | null;
  image_height: number | null;
  image_alt: string;
  rewrite_meta: Record<string, unknown> | null;
  gen_meta: Record<string, unknown> | null;
  attention_cost: number;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export interface CliqueActivity {
  id: string;
  actor_id: string;
  verb:
    | 'posted' | 'blurbed' | 'befriended' | 'joined_circle' | 'created_circle'
    | 'homie_created' | 'homie_evolved' | 'homie_claimed' | 'homie_reel' | 'homie_narrative' | 'homie_cared';
  object_type: 'post' | 'blurb' | 'friendship' | 'circle' | 'homie' | 'homie_event';
  object_id: string;
  circle_id: string | null;
  homie_id: string | null;
  target_user_id: string | null;
  visibility: 'public' | 'friends' | 'circle' | 'private';
  summary: Record<string, unknown>;
  created_at: string;
}

/** Storage buckets and path conventions enforced by 20261019000700_clique_storage.sql. */
export const BUCKETS = { chat: 'clique-chat', media: 'clique-media' } as const;
export const chatImagePath = (threadId: string, userId: string, file: string) => `${threadId}/${userId}/${file}`;
export const mediaPath = (
  userId: string,
  folder: 'avatars' | 'homies' | 'reels' | 'mehspace' | 'posts',
  file: string,
) => `${userId}/${folder}/${file}`;
