# MEND — Handoff

## Goal
Daily "musical surgery" web game: a 4-bar Tone.js groove arrives with 4 sabotaged layers (melody, chords, bass, cadence); the player repairs each by ear. Visual source of truth: design/ (preview, tokens, ux/motion specs).

## Done
- 3f362f1 — design handoff + brand assets baseline.
- 0ed86f5 — full app: daily PRNG + composer (src/core/composer.ts), sabotage engine (src/core/puzzle.ts), unique-answer validator (src/core/validator.ts), Tone.js engine (src/audio/engine.ts), UI controller (src/ui/app.ts), state machine/share/storage (src/game/). Includes /code-review medium fixes (reload mid-theory lock, lost win on early close, Golden Ears loophole, degree spelling, heal sweep timing, absolute og:image).
- 1c276ed — GitHub Pages workflow; live at https://itailiors.github.io/mend/ (deploys on push to main after `npm run check`).

## In progress
- Nothing half done.

## Next 3 steps
1. Listen on a real phone (iOS Safari with the silent switch on + Android): check the mix balance, Solo levels (FOCUS table in src/audio/engine.ts) and the unlock / "Tap to Resume Audio" flow. Audio was never checked by ear.
2. Playtest Stage 4 difficulty: option subtitles show Roman numerals (e.g. "iv in Bb MAJ"), which give the answer away to theory-literate players with names on. Consider mood-neutral colour descriptions.
3. Add a project CLAUDE.md with "Definition of done: npm run check", plus a PWA manifest/icons like Reharm's.

## Decisions and why
- Zero-ambiguity rules (src/core/validator.ts header): S1 note must be a chord tone in a ±2-semitone window; S2 chord root must equal the bar's bass, stay in key, and contain the bar's melody notes; S3 bass = chord root (3rd/5th chips count as wrong); S4 one candidate per mood category. The generator re-rolls days until each stage has exactly one accepted state; tests/puzzle.test.ts proves this for 365 days.
- Stages 1–3 land on three different bars, so each bug is judged against clean layers.
- MEND #1 = 2026-10-07 UTC (so 2026-11-26 = #51, matching the preview).
- Share headline says "Track Restored!" for a Theory-Ace run (spec example); Golden Ears = 4/4 clean fix with note names never shown during the run.
- Edits rebuild plain step arrays read by a single '16n' Transport callback: no node allocation mid-loop; A/B swaps latch on the next beat.
- `?day=YYYY-MM-DD` previews other days on the dev server only.

## Gotchas
- src/styles/app.css is the preview's <style> block extracted verbatim, minus the QA rail, plus a "Production additions" section at the end. Keep visual changes in that section.
- Browser-testing scripts that click right after navigation can run before main.ts mounts: wait ~800 ms first.
- vite.config.ts declares `process` locally (no @types/node); the og:image rewrite runs in generateBundle because asset URLs only resolve at bundle time.
