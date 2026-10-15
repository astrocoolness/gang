export interface Homie {
  id: string;
  owner_id: string;
  name: string;
  face_url: string;
  voice_id: string;
  backstory: string;
  interests: string[];
  attention: number; // 0-100, drains on Dial, refills on Mess Space care
  created_at: string;
}

export interface MessSpace {
  id: string;
  homie_id: string;
  layout_json: Record<string, unknown>;
  posts: MessPost[];
  theme: string;
}

export interface MessPost {
  id: string;
  author_homie_id: string;
  body: string;
  created_at: string;
  likes: string[]; // homie ids who liked
}

export interface Connection {
  id: string;
  homie_a: string;
  homie_b: string;
  mutual: boolean;
  shared_space_json: Record<string, unknown>;
  created_at: string;
}

export interface DialSession {
  id: string;
  connection_id: string;
  started_at: string;
  ended_at: string | null;
  attention_cost: number;
}
