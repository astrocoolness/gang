# Home Builder Spec

**Status:** Not started
**Layer:** 4b — Prompt-to-Home
**Depends on:** Gangland zone 1, Meespace layout contract

## Goal

User types a home description. System sanitizes it against a modular block vocabulary, LLM assembles a layout spec, rules engine validates, renderer builds the 3D scene, saved as Meespace JSON.

## Pipeline

1. Prompt intake + sanitizer (strip non-vocabulary terms)
2. LLM assembler → LayoutNode[] spec
3. Validation: no floating furniture, rooms connect to doors
4. Renderer: assemble from asset library
5. Persist: write layout back to MessSpace

## Files

- `src/lib/home-builder/sanitizer.ts`
- `src/lib/home-builder/assembler.ts`
- `src/lib/home-builder/validator.ts`
- `src/lib/home-builder/renderer.ts`
- `src/lib/home-builder/persist.ts`
- `src/lib/home-builder/vocabulary.ts` — the allowed block list

## Acceptance Checklist

- [ ] Sanitizer removes out-of-vocabulary terms
- [ ] Assembler outputs valid LayoutNode[]
- [ ] Validator catches floating and disconnected rooms
- [ ] Renderer produces a visible 3D home
- [ ] Layout round-trips through Meespace JSON
- [ ] Broken assembler can be swapped without touching other stages

## Risks

- LLM assembler may invent geometry outside vocabulary despite sanitizer
- Vocabulary size vs expressiveness tradeoff

## Next Steps

After ship: situation-engine spec.
