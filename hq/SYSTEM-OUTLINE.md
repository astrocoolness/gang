# GANG — Master System Outline

## Overview

GANG is a four-layer character-social platform. Each layer is a separate module with its own spec file, changelog, and checklist under `hq/`. Layers share one Supabase backend and one design-build-test-ship loop.

---

## Layer 1: Homies (Character Creation)

**Source:** Existing Homies repo (Tamagotchi-style pet sim). Fork and extend, don't rebuild.

- Character creator UI: face picker, voice picker, backstory field, interests field
- Interests drive the situation engine (Layer 5) — a drum-and-bass Homie gets different daily scenes than a bookworm
- Persists to Supabase (migrate from browser-only storage)
- Data model: `Homie { id, name, face, voice, backstory, interests[], attention, messSpaceId, createdAt }`
- Existing dot-grok skills folder (Babylon, Three.js, Phaser, ECS, collision, procedural maps, tilesets) is the asset pipeline for Gangland

## Layer 2: Meespace (Public Profiles)

**Source:** Existing Flyspace repo (MySpace clone). Rename to Meespace, rebrand, reshape data contract.

- Profile page template: posts, layout, theme, mood status, music autoplay, glitter text
- Posts become the "reason someone calls" — visible before Dial connects
- Layout JSON maps to 3D home rooms in Gangland (Layer 4)
- Data model: `MessSpace { id, homieId, posts[], layout, theme, mood, music }`n- Neglect mechanic: inactive Meespaces render as run-down (weeds, dark windows) over time

## Layer 3: Dial (Messaging)

**Source:** Existing Dial repo. Keep the three-dial text rewriter exactly as-is. Add one step.

- Tone, Voice, Cut dials rewrite a seed message via xAI chat API (unchanged)
- **New step:** rewritten text passes to an image model; output is a picture of what the message describes, with the words inlaid
- Image becomes the outgoing message artifact — sent to a connected Homie through GANG
- History stores image URLs instead of text blobs
- Composer renders an `<img>` with download button instead of a paragraph
- No templates, no dial-to-style mapping in v1 — just text in, picture out
- Branch: `image-gen` (already exists on dial repo)

## Layer 4: Gangland (3D World)

- One shared zone, low-poly 32-bit aesthetic
- Walkable avatars for all Homies (player and NPC)
- Proximity-based Dial: stand near someone, call connects
- Player-built homes: text prompt → sanitizer → LLM assembler (modular block vocabulary) → validation rules engine → renderer → saved as Meespace JSON
- Attention visible in-world: glow, companion, or run-down state
- Asset pipeline reuses Homies' dot-grok skills (Babylon/Three.js/Phaser/ECS)

## Layer 5: Situation Engine (Daily Scenes)

- Runs once per day per Homie, no user input needed
- Pulls live data: WUSB/WRIR/WPKN track logs, news, on-this-day, local events (Richmond concerts, releases)
- Scenario seeds: listening to new/old music, reading new/old books, news, on-this-day, informal discovery, bad day + messy room needing cleanup, cooking new/old recipe, planning a trip (hike, vacation, concert)
- Character's interests filter which source gets picked and how they react
- Output feeds the animation pipeline (Homies' existing episode system extended)
- Quirky personalization: profile data colliding with random events (Tony's shelf code + weather)

## Layer 6: NPC System

- Two modes sharing identical underlying pools: **Custom** (user picks name, look, voice, backstory, interests) and **Random** (rolls everything)
- User-curated influencing-concepts database biases the pools
- NPCs: always-on, self-regenerating attention, simplified Dial/Meespace
- Real people characters: human availability, same mechanics

## Layer 7: Connections

- Mutual add flow between Homies
- Every connection is a two-person shared space
- Connection list view in central app
- Data model: `Connection { id, homieA, homieB, sharedSpaceId, createdAt }`

## Layer 8: Infra & Workflow

- Next.js 14 + Tailwind + TypeScript (existing gang scaffold)
- Supabase: tables for homies, mess_spaces, connections, dial_sessions, npc_state, situation_logs, concept_db
- Vercel deploy on merge to main
- HQ folder: per-feature spec files, changelog, checklists
- Design-build-test-ship loop (see EVOLUTION-ROUTINE.md)

---

## Build Order

1. Homies spec + Supabase migration
2. Meespace rename + data contract
3. Dial image-gen branch
4. Gangland zone 1 + avatars
5. Home builder pipeline
6. Situation engine
7. NPC generator + concept DB
8. Connections layer
9. Attention mechanics across all layers
