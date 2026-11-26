# MEND — Motion, Micro-Interaction & Audio-Reactive Visual Spec

> **Design Principle:** Motion in MEND is *telemetry, not decoration*. Every animation communicates either time (the synchronized playhead), signal health (glitch jitter vs. harmonic sine), or surgical state change (Scanline Heal).

---

## 1. Timing Tokens & Easing Curves

| Token | Value | Purpose |
| :--- | :--- | :--- |
| `--dur-instant` | `90ms` | Keycap press depress (`translateY(1px)`), beat LED tick |
| `--dur-fast` | `160ms` | Hover states, slot focus bracket transition, A/B pill switch |
| `--dur-base` | `260ms` | Modal/sheet fade-slide entry, toast reveal |
| `--dur-accordion` | `340ms` | Lane expand / collapse choreography |
| `--dur-shake` | `360ms` | Wrong-attempt horizontal glitch shake |
| `--dur-heal-sweep` | `520ms` | Luminous mint Scanline Heal wave across repaired lane |
| `--dur-victory-unfold` | `640ms` | All 4 lanes unfolding into unified Restored Groove view |
| `--ease-snappy` | `cubic-bezier(0.22, 1, 0.36, 1)` | Accordion transitions, sheets, playhead indicators |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | `⭐` Theory Ace star stamp pop, healed badge settle |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Opacity, color crossfades, theme transitions |

---

## 2. Core Choreography Specifications

### 2.1 Synchronized 4-Bar Playhead Sweep
- **Geometry:** A single `2px` vertical line (`--playhead-line`, `box-shadow: var(--playhead-glow)`) spans from the bottom of the Timeline Ruler continuously across all 4 accordion lanes (`z-index: var(--z-playhead)`, `pointer-events: none`).
- **Motion:** Driven at 60fps via `requestAnimationFrame` translating `transform: translateX(...)` from `0%` to `100%` of the 4-bar track column over the loop duration (`(60 / bpm) * 16` seconds; at `96 BPM`, `10.0s` per 4-bar loop). Never animate `left` — always composite via `translate3d`.
- **Beat Telemetry:** On each quarter-note beat (`beatIdx 0..15`), the active bar label pulses briefly (`90ms`) and the active slot's border luminosity lifts (`1.0 → 1.18` brightness) as the playhead crosses it.

### 2.2 Broken Glitch Loop vs. Healed Sine Pulse
- **Sabotaged Bar (`data-slot-state="broken"`):**
  - Renders a jagged coral (`--state-glitch`) sawtooth SVG path.
  - CSS keyframe `glitch-jitter` (`1.4s steps(2, end) infinite`) applies subtle `±1px` micro-offset and `0.78–1.0` stroke opacity flicker strictly on the faulted bar segment—never on text labels.
- **Healed Bar / Lane (`data-lane-state="healed"`):**
  - Renders a smooth harmonic sine SVG path in the layer's accent color (`--lane-melody`, `--lane-chords`, `--lane-bass`, `--lane-cadence`).
  - Subtle `wave-breathe` (`2.4s ease-in-out infinite alternate`) modulates stroke amplitude (`scaleY(0.92)` to `scaleY(1.06)` around `transform-origin: center`) on beat pulses.

### 2.3 Accordion Stage Expand / Collapse
- **Choreography (`340ms`, `--ease-snappy`):**
  1. Outgoing healed lane compresses smoothly (`flex-grow` / `height` to `44px`), fading out its editor tray over `160ms` while preserving its `4-bar` mini waveform strip horizontally aligned with the playhead.
  2. Incoming broken lane expands (`flex: 1`), revealing its prompt and `>= 48px` controls (`opacity: 0 → 1`, `translateY(8px → 0)` staggered by `60ms`).

### 2.4 Scanline Heal Sweep & Wrong-Attempt Glitch Shake
- **Scanline Heal (`520ms`):**
  - When `onLayerMended` fires, a `72px`-wide vertical gradient beam (`transparent → rgba(46, 230, 166, 0.55) → #FFFFFF (2px) → transparent`) sweeps left-to-right (`translateX(-20% → 120%)`) over the lane's `.heal-scanline` overlay.
  - At `50%` sweep progress, the broken coral slot swaps cleanly to emerald/lane-accent and the jagged SVG path transitions to the smooth sine path.
- **Wrong-Attempt Glitch Shake (`360ms`):**
  - Horizontal damped shake keyframes on the active editor slot/card: `0%: 0`, `18%: -7px`, `36%: +6px`, `54%: -4px`, `72%: +3px`, `100%: 0`.
  - Simultaneous coral flash on the card border + diagnostic toast slide-up (`220ms`).

### 2.5 Theory Diagnosis Card & `⭐` Star Stamp Pop
- **Card Entry (`260ms`, `--ease-snappy`):** Slides up (`translateY(20px → 0)`, `opacity: 0 → 1`) as a non-blocking sheet anchored cleanly above the bottom dock.
- **Star Stamp Pop (`380ms`, `--ease-spring`):** Answering correctly scales the `⭐` badge (`scale(0.3) rotate(-18deg) → scale(1.18) rotate(4deg) → scale(1) rotate(0deg)`) on both the card and the corresponding collapsed lane pill.

### 2.6 Victory 4-Lane Unfold & Before/After A/B Morph
- **Victory Unfold (`640ms` total):** All 4 lanes expand simultaneously to equal `52px–64px` groove visualizer strips with `60ms` per-lane stagger (`0ms, 60ms, 120ms, 180ms`), revealing the achievement inspection seal (`scale(0.85 → 1)`).
- **A/B Waveform Morph (`220ms`, `--ease-standard`):** Toggling `Before (Broken)` ↔ `After (Restored)` crossfades & morphs all 4 lane waveforms between their sabotaged coral glitch state and healed harmonic state while keeping the playhead running uninterrupted.

---

## 3. `prefers-reduced-motion: reduce` Fallbacks

When `@media (prefers-reduced-motion: reduce)` is active:
1. All duration tokens collapse to `1ms` (instant state swaps, zero shake/slide translation).
2. Continuous `glitch-jitter` and `wave-breathe` animations are disabled (`animation: none`).
3. Playhead remains visible and updates cleanly at `15fps` or bar-stepped intervals without blur/glow trails.
4. Scanline Heal and Wrong-Attempt feedback express via crisp static border/badge color swaps and clear text status pills.

---

## 4. Framework-Agnostic Audio-Reactive Visual Trigger Hooks

Claude Code drives all visual telemetry from `Tone.Transport` using the following 7 callbacks (see `design/claude-code-handoff.md` for TypeScript signatures):

| Hook | Triggered By (`Tone.Transport` / Engine) | Visual DOM / CSS Reaction |
| :--- | :--- | :--- |
| `onBeat(beatIdx)` | Quarter-note tick (`0..15` across 4 bars) | Pulses active beat marker in ruler (`is-beat-active`), nudges waveform amplitude LEDs, highlights current slot under playhead. |
| `onBarStart(barIdx)` | Downbeat of Bar `0..3` | Flashes bar header (`BAR 1`–`4`); if `barIdx` contains an unfixed bug, pulses the layer's fault indicator LED. |
| `onAuditionChange(layerId, slotIdx)` | Player taps note/chord/bass/cadence control | Moves warm gold focus bracket (`--state-focus`) onto `slotIdx`, triggers `90ms` keycap press flash on the control, updates slot label. |
| `onWrongAttempt(layerId, slotIdx)` | `Check Fix` fails dissonance validation | Adds `.is-shaking` (`360ms`) to `slotIdx` and lane, flashes `--state-glitch`, updates try counter pill (`tries`), opens diagnostic hint toast. |
| `onLayerMended(layerId, tries)` | `Check Fix` passes validation | Fires `.is-healing` (`520ms` Scanline Heal sweep), morphs waveform from jagged coral to smooth lane-accent sine, stamps `🟢` (`tries===1`) or `🟡` (`tries>1`), collapses lane & presents optional Theory card. |
| `onTheoryBonus(layerId, correct)` | Player answers optional Theory Diagnosis pill | If `correct`, pops `.is-star-pop` (`--state-theory` gold) on card and layer strip; if `false`, softly highlights explanation without penalty; transitions to next stage. |
| `onAllRestored(summary)` | Stage 4 heals (and Theory bonus completes/skips) | Transitions workspace to Victory View, runs staggered 4-lane groove unfold (`640ms`), displays Precision & Theory Ace totals, activates Before/After A/B toggle. |
