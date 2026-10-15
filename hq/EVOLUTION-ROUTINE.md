# GANG — Evolution Routine

The loop that builds and maintains the system. Every feature, fix, and upgrade passes through it. One feature per cycle. No exceptions.

## The Loop: Design → Build → Test → Ship

### 1. Design
- Open or create `hq/specs/<feature>.md` before writing code
- Spec contains: goal, data model changes, file list, acceptance checklist, risks
- If it touches an existing layer, note what stays untouched
- Update `hq/CHANGELOG.md` with a pending entry

### 2. Build
- AI codes against the spec only
- Constrained to one file or one folder per pass
- If context blows up, stop and split the feature
- Log every deviation from spec in the spec file itself

### 3. Test
- Run locally or on Vercel preview
- Walk the acceptance checklist line by line
- Note what broke, what was surprising, what's missing
- Update checklist with results

### 4. Ship
- Merge to main → auto-deploys to Vercel
- Mark changelog entry shipped with date
- Write next-steps in the spec file
- The shipped feature becomes context for the next design pass

## Cadence

- **Daily:** situation engine runs on its own (no human in loop)
- **Per session:** one design-build-test-ship cycle minimum
- **Weekly:** review HQ changelogs across all layers, kill or merge stalled specs
- **Monthly:** re-read SYSTEM-OUTLINE.md, check if reality drifted from the plan, update the outline

## Rules

1. Spec before code. Always.
2. One file or folder per AI pass.
3. Never delete a working feature to add a new one — extend or wrap.
4. Every shipped feature gets a changelog line with date.
5. If a module breaks, fix that module only.
6. The outline is a living document — it changes when the system changes.

## File Map

```
hq/
  SYSTEM-OUTLINE.md    ← this file's sibling, the master plan
  EVOLUTION-ROUTINE.md ← you are here
  CHANGELOG.md         ← append-only log of shipped work
  specs/               ← one file per feature
    homies-spec.md
    meespace-spec.md
    dial-image-gen-spec.md
    gangland-zone1-spec.md
    home-builder-spec.md
    situation-engine-spec.md
    npc-generator-spec.md
    connections-spec.md
  checklists/          ← acceptance criteria per feature
```

## Starting the Next Cycle

1. Read the last changelog entry
2. Pick the next unchecked item from SYSTEM-OUTLINE.md build order
3. Write its spec
4. Build
5. Test
6. Ship
7. Repeat
