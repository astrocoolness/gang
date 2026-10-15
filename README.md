# GANG

Character-based social calling app. Three layers:

- **Homies** — create your character: face, voice, backstory
- **Mess Space** — each character's public profile page (posts, layout, vibe)
- **Dial** — the messenger. Conversations feel like picking up a phone, not typing in a box.

## Core mechanic

The call *is* the relationship. Every Dial session drains a little of a Homie's attention. The only way to refill it is spending time on their Mess Space page — liking posts, changing layout, leaving comments. Communication and care are the same resource. Neglect literally mutes the line.

## Adding characters

Someone builds a Homie. You add them to your app. You land on their Mess Space first — that's the reason you called — then you Dial.

Adding is mutual: every connection is a little two-person network with a shared space between you.

## Stack

- Next.js (App Router)
- Supabase (Homie states, profiles, connections)
- WebRTC / audio stream layer for Dial
- Vercel deploy

## Structure

```
src/
  app/           # routes: /homies, /mess-space/[id], /dial/[id]
  components/    # HomieCard, MessSpace, DialPhone, SharedSpace
  lib/           # data model, supabase client, dial audio
  types/         # Homie, MessSpace, DialSession, Connection
```

## Data model (v1)

- **homies**: id, owner_id, name, face_url, voice_id, backstory, attention (0-100), created_at
- **mess_spaces**: id, homie_id, layout_json, posts (jsonb), theme
- **connections**: id, homie_a, homie_b, shared_space_json, mutual (bool), created_at
- **dial_sessions**: id, connection_id, started_at, ended_at, attention_cost
