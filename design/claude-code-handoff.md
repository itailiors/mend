# MEND — Claude Code Engineering Handoff Contract

> **Scope of This Handoff:** Exact asset inventory, design tokens, state machine, TypeScript data/event interfaces, and Tone.js visual binding rules so Claude Code can implement the procedural 4-bar groove composer, sabotage engine, dissonance validator, and Web Audio synthesis with zero visual drift.

---

## 1. Folder & Asset Inventory

```text
Mend/
├── assets/
│   ├── brand/
│   │   ├── logo.svg                   # 180×40 horizontal wordmark + oscilloscope tile (uses currentColor)
│   │   ├── favicon.svg                # 32×32 rounded obsidian square icon
│   │   ├── apple-touch-icon.png       # 512×512 hi-fi oscilloscope app icon
│   │   └── og-image.png               # 1200×630 social preview card
│   ├── badges/
│   │   ├── badge-frame.svg            # 120×120 CSS-colorable diagnostic bezel overlay
│   │   ├── layer-melody.png           # 512×512 Cyan studio-enamel emblem
│   │   ├── layer-chords.png           # 512×512 Violet studio-enamel emblem
│   │   ├── layer-bass.png             # 512×512 Amber studio-enamel emblem
│   │   ├── layer-cadence.png          # 512×512 Emerald studio-enamel emblem
│   │   ├── stamp-chief-surgeon.png    # 512×512 Octagonal 4/4 Clean Fix seal
│   │   ├── stamp-track-restored.png   # 512×512 Circular victory seal
│   │   ├── stamp-theory-ace.png       # 512×512 Gold 4/4 ⭐ seal
│   │   └── stamp-golden-ears.png      # 512×512 Reference headphones seal
│   └── icons/                         # 17 inline-ready 24×24 stroke="currentColor" SVGs
│       ├── ab-compare.svg, full-mix.svg, glitch-bug.svg, healed-check.svg,
│       ├── help.svg, lock.svg, nudge-down.svg, nudge-up.svg, pause.svg,
│       ├── play.svg, share.svg, solo-headphones.svg, sound-muted.svg,
│       ├── sound-on.svg, star-ace.svg, stats.svg, theme-toggle.svg
└── design/
    ├── brand-bible.md                 # Visual identity, colors, WCAG AA contrast, typography
    ├── ux-spec.md                     # Mobile-first 390×844 spec + all 8 views + Safari rules
    ├── motion-spec.md                 # Easing, durations, reduced-motion, 7 visual triggers
    ├── tokens.json                    # W3C-structured design tokens
    ├── tokens.css                     # Production CSS custom properties (Dark + Light)
    ├── claude-code-handoff.md         # This contract
    └── preview/
        └── index.html                 # Interactive visual-only prototype (mocked Puzzle #51)
```

---

## 2. Token, Theme & Accessibility Attribute Contract

1. **Import `design/tokens.css` at root** (or transform `design/tokens.json` into Tailwind/CSS variables). Load Google Fonts: `Space Grotesk` (`600;700`), `Plus Jakarta Sans` (`400;500;600;700`), `JetBrains Mono` (`500;600;700`).
2. **Theme Attribute:** Toggle `data-theme="dark"` (default) or `data-theme="light"` on `<html>` (`document.documentElement`). Never hardcode hex values in components—always use semantic CSS vars (`--bg-surface`, `--lane-melody-text`, `--state-healed`, etc.).
3. **Note-Label Visibility Attribute:** Toggle `data-note-labels="show"` (default) or `data-note-labels="ear-only"` on the root shell. In `ear-only` mode, CSS hides explicit pitch/chord text inside puzzle slots (e.g. `F#4`, `A Maj`) while preserving bar numbers, rhythmic contours, and waveforms.
4. **Touch Targets & Viewport Fit:** Keep primary interactive controls `min-height: var(--touch-target-min)` (`48px`) and preserve the `52px / 24px / 3×44px / flex:1 / 76px` vertical layout budget so `390×844` never requires page scrolling during Stages 1–4.

---

## 3. Accordion State Machine

```text
[LOCKED_AUDIO_GATE]
   │  (Tap "▶ Listen to Broken Track" -> Safari AudioContext + silent <audio> unlock)
   ▼
[STAGE_ACTIVE(layerIndex = 0..3)]
   ├──► audition slot / change value  ──► onAuditionChange(layerId, slotIdx)
   ├──► checkFix() === false          ──► onWrongAttempt(layerId, slotIdx)  [tries++]
   └──► checkFix() === true           ──► onLayerMended(layerId, tries)     [520ms Heal Sweep]
           │
           ▼
   [THEORY_BONUS_OPTIONAL(layerId)]
      ├──► Tap "Skip -> Next Layer"   ──► advance to next stage (or Victory)
      └──► Answer pill                ──► onTheoryBonus(layerId, correct) -> advance
           │
           ▼ (after Stage 4 completes)
[VICTORY_RESTORED]
   │  onAllRestored(summary)
   ├──► A/B Toggle ("Before Broken" <-> "After Restored")
   └──► Open Share Modal / Stats Drawer
```

---

## 4. TypeScript Data & Event Contracts

```ts
export type LayerId = 'melody' | 'chords' | 'bass' | 'cadence';

export type LayerStatus = 'locked' | 'active' | 'healed' | 'patched';

export interface TheoryBonusQuestion {
  prompt: string;
  options: [string, string, string];
  correctIndex: 0 | 1 | 2;
  explanation: string;
  shareTag: string; // e.g., "Out-of-Key b5", "Wrong 3rd (Maj/min)"
}

export interface StageBugSpec {
  layerId: LayerId;
  stageNumber: 1 | 2 | 3 | 4;
  promptLine: string;
  targetMoodPill?: string; // Mandatory for Stage 4 (e.g., "Dreamy Lydian #4 Lift")
  faultySlotIndex: number; // 0..7 for Stage 1 melody, 0..3 for Stages 2–4
  sabotagedValue: string;  // Display label before repair (e.g., "F#4", "A Maj")
  targetValue: string;     // Display label when solved (e.g., "F4", "A Min")
  theoryBonus: TheoryBonusQuestion;
}

export interface LayerTrackState {
  layerId: LayerId;
  status: LayerStatus;
  tries: number;           // 0 until solved; 1 = Clean Fix (🟢), 2+ = Patched (🟡)
  theoryAce: boolean;      // true if optional Theory Bonus answered correctly (⭐)
  selectedSlotIndex: number;
  currentValue: string;
}

export interface DailyMendPuzzle {
  puzzleNumber: number;    // e.g., 51
  dateIso: string;         // UTC YYYY-MM-DD
  bpm: number;             // e.g., 96
  keySignature: string;    // e.g., "C Major"
  bars: [string, string, string, string]; // Reference chord labels per bar
  stages: [StageBugSpec, StageBugSpec, StageBugSpec, StageBugSpec];
}

export interface MendSummary {
  puzzleNumber: number;
  totalTaps: number;       // Sum of tries across 4 layers (ideal = 4)
  theoryAces: number;      // 0..4
  stampId: 'chief-surgeon' | 'track-restored' | 'theory-ace' | 'golden-ears';
  layers: LayerTrackState[];
}

export interface SharePayload {
  puzzleNumber: number;
  headline: string;        // "🩺 MEND #51 — Track Restored!"
  shareText: string;       // Pre-formatted multi-line Bandle-adjacent diagnostic card
}

export interface MendVisualHooks {
  onBeat(beatIdx: number): void;
  onBarStart(barIdx: number): void;
  onAuditionChange(layerId: LayerId, slotIdx: number): void;
  onWrongAttempt(layerId: LayerId, slotIdx: number): void;
  onLayerMended(layerId: LayerId, tries: number): void;
  onTheoryBonus(layerId: LayerId, correct: boolean): void;
  onAllRestored(summary: MendSummary): void;
}
```

---

## 5. Tone.js Integration & Mobile Safari Checklist

1. **Pre-Allocate Synth Pool at Startup:** Instantiate the 4-layer Tone.js instruments (`Melody`, `Chords`, `Bass`, `Cadence`) + `Drums` once at app boot so live nudging/flipping never allocates nodes mid-loop (zero GC audio clicks).
2. **Bind Safari Unlock to "Power On" CTA:** Trigger `await Tone.start()`, `navigator.audioSession.type = 'playback'` (guarded), and play the silent base64 `<audio>` loop inside the exact click handler of `▶ Listen to Broken Track`.
3. **Playhead Sync:** Compute normalized loop progress (`0..1`) from `Tone.Transport.progress` (or `seconds / loopDuration`) inside a `requestAnimationFrame` tick and apply `transform: translate3d(calc(progress * 100%), 0, 0)` to the unified playhead element.
4. **Live Audition Quantization:** Apply live parameter edits on the next 16th/8th boundary (or crossfade `15ms`) and call `hooks.onAuditionChange(layerId, slotIdx)` immediately so visual feedback feels instantaneous.
5. **Solo vs. Full Mix:** Mute non-active layer channels when `mixMode === 'solo'` (keep drums gently audible or muted per mix tuning) and toggle `.is-dimmed` on collapsed lanes so visual and acoustic focus stay 1:1.
6. **Before/After A/B Playback:** Keep both the sabotaged 4-layer event list and the restored 4-layer event list ready in memory; flipping the Victory A/B switch swaps active track patterns on the next bar/beat boundary and toggles `.is-ab-before` on the 4-lane visualizer.
