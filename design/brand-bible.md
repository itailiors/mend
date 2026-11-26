# MEND — Brand Bible & Art Direction

> **Tagline:** *Daily Musical Surgery — Broken Signal → Healed Groove*  
> **Aesthetic:** Precision Sound-Lab Bench (Vintage Japanese Hi-Fi Oscilloscope × Teenage Engineering OP-1 × Clean Diagnostic Telemetry)

---

## 1. Visual Positioning & Differentiation

Most music-theory games fall into one of two visual traps:
1. **Cluttered Bedroom-Pro DAWs** — tiny 10px knobs, overlapping piano-roll chrome, dense mixer faders, and intimidating jargon.
2. **Dry Conservatory Grids** — clinical Wordle boxes or bare staff notation that feel like homework.

**MEND** occupies a distinct tactile space: **a warm, precision audio-restoration bench**. Every surface looks like machined hardware housing a crisp, high-contrast oscilloscope well. Controls feel like physical OP-1 keycaps (`2px` bottom bevel, generous `>= 48px` hit targets, clear phosphor LEDs). Instead of grading players with red/green Wordle squares, MEND visualizes **signal health**.

---

## 2. Core Visual Metaphor: Broken Signal → Healed Groove

Every layer of the daily 4-bar track is rendered as a live diagnostic channel:

- **Sabotaged / Clash (`#FF5468` Coral-Red / `#F5A623` Amber):**  
  Faulted bars pulse with a subtle jagged sawtooth/clipping waveform trace, a coral fault LED, and micro-glitch horizontal jitter. Even on mute, your eyes spot where the signal is hurting.
- **Editing Focus (`#FFD166` Warm Highlight):**  
  Selecting a note or bar illuminates a calibrated warm-gold inspection bracket around the slot so one-thumb adjustments never miss.
- **Heal Sweep (`#2EE6A6` Luminous Mint):**  
  The instant a valid repair snaps into place, a vertical **Scanline Heal** wave sweeps left-to-right across the lane (`520ms`), smoothing the jagged fault trace into a calm, breathing sine wave synchronized to `96 BPM`.
- **Locked / Pending (`#64748B` Muted Slate):**  
  Unreached layers sit quietly in standby with dimmed telemetry dots so your ear and eyes stay locked onto the active stage.

---

## 3. Color System (Dark-First + Light Lab-Bench)

### 3.1 Surfaces & Chrome

| Role | Dark Token (`[data-theme="dark"]`) | Dark Hex | Light Token (`[data-theme="light"]`) | Light Hex | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Canvas | `--bg-canvas` | `#0B0E14` | `--bg-canvas` | `#F2F1EC` | App backdrop / outer chassis |
| Surface | `--bg-surface` | `#131822` | `--bg-surface` | `#FAF9F5` | Accordion lane bodies, top bar, dock |
| Elevated | `--bg-surface-elevated` | `#1B2230` | `--bg-surface-elevated` | `#FFFFFF` | Modals, Theory Diagnosis card, active cards |
| Recessed Well | `--bg-well` | `#080B10` | `--bg-well` | `#E6E4DC` | Oscilloscope waveform tracks & piano-roll wells |
| Tactile Keycap | `--bg-control` | `#212A3A` | `--bg-control` | `#EAE8E0` | Nudge buttons, chord flippers, transport buttons |
| Primary Ink | `--text-primary` | `#F2F6FC` | `--text-primary` | `#121822` | Wordmark, headings, chord/note labels |
| Secondary Ink | `--text-secondary` | `#9AA7BD` | `--text-secondary` | `#475467` | Prompts, subtitles, diagnostic descriptions |
| Muted Ink | `--text-muted` | `#7C8A9E` | `--text-muted` | `#5B6779` | Bar numbers (`BAR 1–4`), inactive tags |

### 3.2 Four Instrument-Lane Accents

Each layer carries a unique phosphor signature across borders, LEDs, waveforms, and badges:

| Layer | Name | Dark Accent | Dark Text Token | Light Accent | Light Text Token |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Melody** | **Phosphor Cyan** | `#38D9F5` | `#7BE6FA` | `#0284A8` | `#02607A` |
| **2. Chords** | **Harmonic Violet** | `#A78BFA` | `#C4B5FD` | `#6D4AFF` | `#502ED1` |
| **3. Bass** | **Vacuum Amber** | `#F5A623` | `#FCC668` | `#C46E00` | `#8F4E00` |
| **4. Cadence** | **Signal Emerald** | `#2EE6A6` | `#6CF2C2` | `#0A875C` | `#076B48` |

### 3.3 Diagnostic State Palette

| State | Meaning | Dark Accent / Text | Light Accent / Text | Emoji / Share Glyph |
| :--- | :--- | :--- | :--- | :--- |
| **Sabotaged / Clash** | Active bug or wrong check | `#FF5468` / `#FF8A98` | `#D92D45` / `#B31D32` | `🩹` / Fault LED |
| **Editing Focus** | Selected note or bar slot | `#FFD166` / `#FFE08A` | `#B87500` / `#8A5600` | Gold bracket |
| **Mended / Clean Fix** | Solved in 1 try | `#2EE6A6` / `#6CF2C2` | `#0A875C` / `#076B48` | `🟢` |
| **Patched / Multi-Try** | Solved in 2+ tries | `#F5B731` / `#FBD374` | `#B26A00` / `#8A5000` | `🟡` |
| **Theory Ace** | Optional Theory Bonus solved | `#FFE066` / `#FFE98A` | `#A86400` / `#7E4A00` | `⭐` |
| **Locked / Pending** | Future stage in standby | `#64748B` / `#8C9BB0` | `#667085` / `#4E586B` | `🔒` |

### 3.4 Verified WCAG AA Contrast Matrix

All text and badge pairings meet or exceed **WCAG 2.1 AA (`>= 4.5:1` for normal text, `>= 3.0:1` for large text/graphics)**:

| Foreground | Background | Theme | Contrast Ratio | Status |
| :--- | :--- | :--- | :--- | :--- |
| `#F2F6FC` (`--text-primary`) | `#131822` (`--bg-surface`) | Dark | **15.8 : 1** | AAA Pass |
| `#9AA7BD` (`--text-secondary`) | `#131822` (`--bg-surface`) | Dark | **7.1 : 1** | AAA Pass |
| `#7C8A9E` (`--text-muted`) | `#131822` (`--bg-surface`) | Dark | **4.9 : 1** | AA Pass |
| `#7BE6FA` (`--lane-melody-text`) | `#131822` (`--bg-surface`) | Dark | **11.4 : 1** | AAA Pass |
| `#C4B5FD` (`--lane-chords-text`) | `#131822` (`--bg-surface`) | Dark | **9.7 : 1** | AAA Pass |
| `#FCC668` (`--lane-bass-text`) | `#131822` (`--bg-surface`) | Dark | **10.6 : 1** | AAA Pass |
| `#6CF2C2` (`--state-healed-text`) | `#131822` (`--bg-surface`) | Dark | **11.8 : 1** | AAA Pass |
| `#FF8A98` (`--state-glitch-text`) | `#131822` (`--bg-surface`) | Dark | **7.4 : 1** | AAA Pass |
| `#FFE98A` (`--state-theory-text`) | `#1B2230` (`--bg-surface-elevated`) | Dark | **12.5 : 1** | AAA Pass |
| `#080B10` (`--text-inverse`) | `#2EE6A6` (`--state-healed`) | Dark | **12.2 : 1** | AAA Pass |
| `#121822` (`--text-primary`) | `#FAF9F5` (`--bg-surface`) | Light | **16.7 : 1** | AAA Pass |
| `#475467` (`--text-secondary`) | `#FAF9F5` (`--bg-surface`) | Light | **7.2 : 1** | AAA Pass |
| `#5B6779` (`--text-muted`) | `#FAF9F5` (`--bg-surface`) | Light | **5.4 : 1** | AA Pass |
| `#02607A` (`--lane-melody-text`) | `#FAF9F5` (`--bg-surface`) | Light | **6.8 : 1** | AA Pass |
| `#502ED1` (`--lane-chords-text`) | `#FAF9F5` (`--bg-surface`) | Light | **7.6 : 1** | AAA Pass |
| `#8F4E00` (`--lane-bass-text`) | `#FAF9F5` (`--bg-surface`) | Light | **6.1 : 1** | AA Pass |
| `#076B48` (`--state-healed-text`) | `#FAF9F5` (`--bg-surface`) | Light | **6.4 : 1** | AA Pass |
| `#B31D32` (`--state-glitch-text`) | `#FAF9F5` (`--bg-surface`) | Light | **6.1 : 1** | AA Pass |
| `#7E4A00` (`--state-theory-text`) | `#FFFFFF` (`--bg-surface-elevated`) | Light | **7.3 : 1** | AAA Pass |

> **Rule:** Never place Dark-theme phosphor text tokens (`#6CF2C2`, `#FFE98A`) on Light-theme backgrounds; always resolve via semantic CSS variables (`var(--state-healed-text)`, etc.).

---

## 4. Typography Pairing (Google Fonts)

1. **Display / Wordmark & Headlines — `Space Grotesk` (600, 700)**  
   Geometric, slightly technical warmth that echoes vintage Roland/Sony faceplates without feeling robotic. Used for stage headers, victory title (`Track Restored!`), and modal titles.
2. **UI Body & Diagnostic Prompts — `Plus Jakarta Sans` (400, 500, 600, 700)**  
   High x-height and open counters for effortless scanning of 1-line prompts (`"Bar 2 has a sour pitch — nudge until it grooves"`) at `13px–15px` on mobile.
3. **Telemetry & Musical Symbols — `JetBrains Mono` (500, 600, 700)**  
   Always paired with `font-variant-numeric: tabular-nums;` so live BPM readouts (`96 BPM · C MAJ`), puzzle IDs (`#51`), tap counters (`5/4 TAPS`), chord symbols (`Am`, `Fmaj7#11`), and pitch swaps (`F# → F`) never jitter horizontally during updates.

---

## 5. Tactile Hardware Language & Asset Suite

- **Surface Rules:**
  - Oscilloscope tracks sit in recessed wells (`--bg-well` + `--shadow-well`) with subtle vertical bar dividers at `25%`, `50%`, `75%`.
  - Interactive buttons behave like physical console keycaps (`--shadow-keycap`, translating `1px` downward on `:active`).
  - Status LEDs are `6px` circles paired with text/icon redundancy so color is never the sole indicator.
- **Asset Inventory:**
  - `assets/brand/logo.svg`, `favicon.svg`, `apple-touch-icon.png`, `og-image.png`
  - `assets/badges/badge-frame.svg` + 4 studio-enamel layer emblems (`layer-melody.png`, `layer-chords.png`, `layer-bass.png`, `layer-cadence.png`) + 4 diagnostic inspection seals (`stamp-chief-surgeon.png`, `stamp-track-restored.png`, `stamp-theory-ace.png`, `stamp-golden-ears.png`)
  - `assets/icons/*.svg` — 17 bespoke `24×24` (`1.75px` stroke) inline-ready icons.
