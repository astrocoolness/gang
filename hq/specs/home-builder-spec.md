# Home Builder Spec

**Status:** Queued (starts after Gangland Zone 1 ships)
**Layer:** 4b — Prompt-to-Home

## Goal

User types a home description. System sanitizes it against a modular block vocabulary, LLM assembles a layout spec, rules engine validates, renderer builds the 3D scene, saved as Meespace JSON.

## Pipeline

1. Prompt intake + sanitizer
2. LLM assembler → layout spec
3. Validation rules engine
4. Renderer (modular blocks)
5. Persistence → Meespace JSON

## Files to Touch

- `src/lib/home-builder/` — sanitizer, assembler, validator, renderer
- `src/components/home-builder/` — prompt input, preview
- Block asset library (from dot-grok tilesets)

## Untouched

- Gangland zone logic
- Meespace profile UI

## Acceptance Checklist

- [ ] Sanitizer strips non-vocabulary terms
- [ ] Assembler outputs valid layout spec
- [ ] Validator catches floating furniture and disconnected rooms
- [ ] Renderer produces viewable 3D home
- [ ] Home saves as Meespace layout JSON
- [ ] Re-editing a saved home reloads correctly

## Risks

- LLM assembler inconsistency; constrain vocabulary hard
- Large homes may exceed block budget

## Next Steps

After ship: write `situation-engine-spec.md`.
