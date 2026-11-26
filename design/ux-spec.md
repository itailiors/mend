# MEND — Mobile-First UX & State Architecture

> **Primary Viewport:** `390×844` (iPhone 13/14/15 portrait, one-thumb reach)  
> **Desktop Scaling:** `1280×800` (centered `760px` precision sound-lab bench chassis)

---

## 1. Mobile-First Above-the-Fold Pixel Budget (`390×844`)

Every active stage (`Stages 1–4`) MUST fit cleanly inside the `844px` viewport **with zero vertical page scrolling**, keeping all 4 bars, all 4 tracks, the active editor controls, and the transport dock simultaneously visible:

| Zone | Height Budget | Notes |
| :--- | :--- | :--- |
| **Top Diagnostic Bar** | `52px` | `MEND` compact mark, `#51` badge, `96 BPM · C MAJ` chip, Sound, Help, Stats, Settings/Theme |
| **4-Bar Timeline Ruler** | `24px` | `BAR 1 · BAR 2 · BAR 3 · BAR 4` + 16 beat ticks + unified playhead head |
| **3 Collapsed Lanes** | `3 × 44px = 132px` | Live mini-waveform strips + status pill (`🔒 Pending`, `🟢 1 try`, `🟡 2 tries`, `⭐`) |
| **1 Active Expanded Lane** | `flex: 1` (`~536px` minus gaps ≈ `480–510px`) | Layer header + 1-line prompt + 4-bar interactive slot/grid + `>= 48px` thumb control deck |
| **Bottom Transport Dock** | `76px` (+ safe-area) | `Play / Pause` (`>= 48px`), `Solo` / `Full Mix` segmented toggle (`>= 48px`), `Check Fix` (`>= 48px`) |
| **Vertical Gaps & Padding** | `~24px` | `6px` inter-lane gaps; zero outer scroll (`height: 100dvh; overflow: hidden`) |

### Desktop (`1280×800`) Scaling
- The main bench centers at `max-width: 760px` inside a subtle brushed-obsidian studio backdrop (`--bg-canvas`), with expanded lane height capped comfortably (`min-height: 360px`) and crisp hover states added alongside touch states.

---

## 2. Mobile Safari Audio Constraints (From Research Section 1)

iOS Safari's hardware silent switch mutes standard Web Audio `AudioContext` output silently, and autoplay policies block audio before a user gesture.

- **Solution — Tactile "Power On" Deck:**  
  Instead of a jarring browser permission alert, first visit presents a warm hi-fi console standby card (`▶ Listen to Broken Track`). That single tap runs:
  1. `AudioContext.resume()` / `Tone.start()`
  2. `navigator.audioSession.type = 'playback'` (when supported)
  3. Silent looping base64 `<audio>` element fallback to force iOS out of the Ringer/Ambient channel into Media playback
- **Silent-Switch & Interrupted Audio Guardrails:**  
  - A compact muted-audio indicator chip in the top bar lets commuters switch to visual-only or test tone immediately.
  - On `visibilitychange` (app switching back to Safari), if `AudioContext.state === 'suspended' | 'interrupted'`, display a single non-intrusive `Tap to Resume Audio` pill in the transport dock without resetting puzzle state.

---

## 3. Complete Specification of All 8 Views & States

### View 1: First-Visit Landing & Tactile Audio-Unlock Deck ("Power On")
- **Visual:** Translucent dark scrim over the live (frozen) 4-lane studio bench; centered hardware console card featuring the `logo.svg` emblem, glowing oscilloscope preview strip (coral glitch wave waiting to be mended), Puzzle `#51 · C Major · 96 BPM` readout, and a 3-bullet micro-brief (*4 broken layers · Repair by ear · Optional ⭐ theory bonus*).
- **Primary CTA:** Chunky `54px`-tall luminous mint keycap **`▶ Listen to Broken Track`**.
- **Secondary Action:** Subtle `Play Visual-Only (Muted)` text link for silent commuters.

```text
+--------------------------------------+
|  [MEND]  #51 · 96 BPM · C MAJ   ? 📊 |
|--------------------------------------|
|  [  POWER-ON DIAGNOSTIC CARD      ]  |
|  [  Daily Track #51 · 4 Faults    ]  |
|  [  ~~~\/\/\/~~~ -> ~~~~~~~~~~~~  ]  |
|  [  ▶ Listen to Broken Track      ]  |  <- 54px CTA (unlocks iOS Audio)
|  [    Start Muted (Visual Mode)   ]  |
+--------------------------------------+
```

### View 2: The 4-Layer Staged Accordion Mini-DAW (Core Workspace)
- **Top Bar (`52px`):** `MEND` mark + `#51` pill on left; `96 BPM · C MAJ` telemetry chip center; `Sound On/Muted`, `Help (?)`, `Stats`, `Settings` icon buttons (`40px` visual hit-padded to `>= 44–48px` tap zone) on right.
- **Timeline Ruler (`24px`):** Divides the track area into `BAR 1 | BAR 2 | BAR 3 | BAR 4` with beat ticks (`1·2·3·4`).
- **Synchronized Vertical Playhead:** A single crisp vertical hairline (`--playhead-line`) aligned identically across the Timeline Ruler and all 4 accordion lanes so players see *exactly* when the playhead crosses a sour bar.
- **Collapsed Lanes (`44px`):** Show layer LED + enamel badge/label (`1. Melody`, `2. Chords`, `3. Bass`, `4. Cadence`), compact live 4-bar waveform strip (jagged coral on unfixed bar, calm smooth wave on fixed bars, dimmed flat trace when locked), and right-aligned status pill (`🔒 Pending`, `🟢 Clean · 1 try`, `🟡 Patched · 2 tries`, plus earned `⭐`).
- **Persistent Bottom Transport Dock (`76px`):**
  1. **`Play / Pause` (`52×52px`)** — toggles live loop playback.
  2. **`Solo` vs `Full Mix` Segmented Toggle (`48px` tall)** — critical usability win: isolates the active broken layer so subtle bass/chord clashes stand out immediately, or plays the full 4-layer mix for context.
  3. **`Check Fix` (`48px` tall, full-width flex primary CTA)** — confirms the player's current repair (or shows `Live Audition` status).

### View 3: Tailored Stage Editor Layouts (Inside the Expanded Accordion)

1. **Stage 1 — The Sour Note (Melody · Warmup · Cyan `#38D9F5`)**
   - **Prompt:** `"Spot the out-of-key note and nudge it back into C Major."`
   - **Visual Grid:** 8 chunky note blocks across 4 bars (2 notes per bar) inside a recessed piano-roll well with subtle faint diatonic grid lines. Bar 2's `F#4` glows coral-red with a fault pulse.
   - **Controls (`>= 48px`):** Tapping any note highlights it in warm gold (`--state-focus`); big bottom control row has **`▼ -1`** (`52px`), live note readout pill (`Bar 2 · Note 3: F#4`), and **`▲ +1`** (`52px`).
2. **Stage 2 — The Broken Chord (Harmony · Medium · Violet `#A78BFA`)**
   - **Prompt:** `"One chord clashes with the melody — flip its quality or root."`
   - **Visual Grid:** 4 chunky chord bar cards (`Bar 1: C Maj`, `Bar 2: G7`, `Bar 3: A Maj [FAULT]`, `Bar 4: F Maj`).
   - **Controls (`>= 48px`):** Tapping Bar 3 opens a compact 2-part flipper: **Root Stepper** (`◀ A ▶`, `48px` buttons) + **5 Quality Keycaps** (`Maj`, `min`, `7`, `dim`, `sus`, each `48px` tall).
3. **Stage 3 — The Bass Betrayal (Bass / Inversion · Medium-Hard · Amber `#F5A623`)**
   - **Prompt:** `"Align the bass note cleanly beneath the healed chords."`
   - **Visual Grid:** Read-only **Chord Reference Strip** (`C Maj | G7 | A min | F Maj`) pinned directly above 4 aligned Bass bar cards (`C2 | G2 | F#2 [FAULT] | F2`) so players visually connect chord roots/3rds/5ths to bass notes.
   - **Controls (`>= 48px`):** Tapping Bar 3 activates the **Bass Pitch / Inversion Stepper** (`▼ -1`, `▲ +1`, plus quick role chips `Root (A)` / `3rd (C)` / `5th (E)` — all `>= 48px`).
4. **Stage 4 — The Cadence / Mode Polish (Final Fix · Hard · Emerald `#2EE6A6`)**
   - **Prompt + Target Mood Pill:** Prominently displays **`🎯 Target: Dreamy Lydian #4 Lift`** above the 4-bar cadence strip (`Bar 1–3` locked/healed, `Bar 4` glowing coral as `F min`), eliminating harmonic ambiguity.
   - **Controls (`>= 48px`):** 4 clean Bar-4 cadence candidate cards (`F Maj`, `Fmaj7#11 (Lydian #4)`, `Fm6`, `G7/F`) at `>= 52px` height with live harmonic color descriptions.

### View 4: Live Repair Micro-States
- **Wrong Fix / Still Clashing:**  
  Tapping `Check Fix` on an incorrect edit triggers a crisp `360ms` horizontal glitch shake on the faulty slot, flashes coral-amber border glow, increments the layer try badge (`1 → 2 tries`), and shows a helpful non-punishing diagnostic toast (`"Still clashing — listen closely to Bar 3"`). Zero lockouts.
- **Layer Healed Snap:**  
  Tapping `Check Fix` on the right edit sweeps a luminous mint **Scanline Heal** gradient left-to-right (`520ms`), smooths the waveform into a steady sine wave, stamps `🟢 Clean Fix · 1 try` (or `🟡 Patched · N tries`), and opens the optional Theory Bonus micro-card before expanding the next layer.

### View 5: Optional "🎓 Theory Diagnosis" Bonus Micro-Card
- **Behavior:** Slides up smoothly (`260ms`) as a compact bottom sheet / overlay card after a layer heals. **100% optional and non-blocking.**
- **Layout:**
  - Header: `🎓 Theory Diagnosis · Optional Bonus ⭐`
  - Question (e.g., Stage 2): `"Why did A Maj clash in Bar 3 against the C melody?"`
  - **3 Crisp Tap Pills (`>= 48px`):** `Major vs. Minor 3rd`, `Out-of-Key Tritone`, `Missing Bass Octave`.
  - **Prominent Escape Hatch (`>= 48px`):** Full-width secondary button **`Skip → Next Layer`** right below, so casual ear-first players never feel trapped in a quiz.
  - Correct answer flashes luminous gold (`--state-theory`), pops a `⭐` stamp onto that layer's collapsed strip, and advances seamlessly.

### View 6: "Track Restored!" Victory & Before/After A/B Screen
- Replaces the accordion editor state once Stage 4 heals:
  - **Header Badge:** `stamp-chief-surgeon.png` (if 4/4 Clean Fix) or `stamp-track-restored.png` + Diagnostic Stamp title (`Chief Surgeon` / `Track Restored`).
  - **Unified 4-Lane Restored Groove Visualizer:** All 4 tracks unfold simultaneously (`640ms` stagger) at comfortable `52px` height each, pulsing together under the synchronized playhead.
  - **Before (Broken) vs. After (Restored) A/B Toggle (`>= 48px`):**  
    - `After (Restored)`: Lush color-coded smooth harmonic waves across all 4 lanes.
    - `Before (Broken)`: Instantly flips all 4 waves back to jagged coral fault lines with fault badges (`F#4`, `A Maj`, `F#2`, `Fm`) so players delight in hearing/seeing how cursed the original track was.
  - **Metrics Strip (`JetBrains Mono` tabular):** `Precision: 5/4 taps` | `Theory Aces: 4/4 ⭐` | `Streak: 7d`.
  - **Primary CTA:** **`Share Diagnostic Card`** (`52px`).

### View 7: Viral Share Modal
- Clean Bandle-adjacent preview card inside an elevated modal:
```text
🩺 MEND #51 — Track Restored!
🎵 Melody   🟢 (1 try)  ⭐ Out-of-Key b5
🎹 Chords   🟢 (1 try)  ⭐ Wrong 3rd (Maj/min)
🎸 Bass     🟡 (2 tries) ⭐ Missed Root
✨ Cadence  🟢 (1 try)  ⭐ Lydian #4
Precision: 5/4 taps | Theory Aces: 4/4 ⭐
```
- **`Copy Share Card` (`52px`)** button with instant `"Copied to clipboard!"` visual confirmation + `Close` button (`48px`).

### View 8: 15-Second Visual How-to-Play, Stats Drawer & Settings
- **How-to-Play Modal:** 3 illustrated horizontal cards (`1. Spot the Sour Glitch` -> `2. Nudge or Flip Live` -> `3. Optional ⭐ Theory Bonus`), readable in under 15 seconds, plus `Got It — Start Mending` (`50px`).
- **Stats / Streak Drawer:** Current Streak, Best Streak, Clean-Fix Rate, Try Distribution bars, and earned Studio-Enamel Achievement Seals (`stamp-chief-surgeon.png`, `stamp-track-restored.png`, `stamp-theory-ace.png`, `stamp-golden-ears.png`).
- **Settings Sheet:**
  - **Theme Switcher (`>= 48px`):** `Dark Sound-Lab` vs `Light Lab-Bench`.
  - **Note Labels (`>= 48px`):** `Show Note Names` (displays `F#4`, `A Min`) vs `Pure Ear` (hides note/chord text on puzzle slots for purists).
