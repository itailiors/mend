/**
 * Accordion state machine (handoff §3) as plain data + pure transitions, so the UI,
 * persistence and tests all drive the same logic.
 *
 *  LOCKED_AUDIO_GATE → STAGE_ACTIVE(0..3) → THEORY_BONUS_OPTIONAL → … → VICTORY_RESTORED
 */
import type { Chord, EditableQuality, LayerId, LayerTrackState, MendPuzzle, MendSummary, StampId, TrackValues } from '../types';
import { LAYERS } from '../types';
import { bassMidi, chordLabel, midiName } from '../core/theory';
import { checkBass, checkCadence, checkChord, checkMelody } from '../core/validator';

export interface GameState {
  dateIso: string;
  /** 0..3 = active layer index, 4 = victory. */
  stage: number;
  layers: Record<LayerId, LayerTrackState>;
  /** Working values of the whole track (starts as the broken track). */
  values: TrackValues;
  /** Bar-4 candidate currently auditioned. */
  cadenceIdx: number;
  /** Layer whose optional theory card is open (or waiting to open). */
  pendingTheory: LayerId | null;
  /** Theory answers given: true/false, null = skipped/not yet. */
  theory: Record<LayerId, boolean | null>;
  /** Set once any fix was checked with note names visible (Golden Ears needs pure-ear). */
  labelsSeen: boolean;
}

const cloneValues = (v: TrackValues): TrackValues => ({
  melody: [...v.melody],
  chords: v.chords.map((c) => ({ ...c })),
  bass: [...v.bass],
});

export function newGame(p: MendPuzzle): GameState {
  const layers = {} as Record<LayerId, LayerTrackState>;
  LAYERS.forEach((id, i) => {
    layers[id] = {
      layerId: id,
      status: i === 0 ? 'active' : 'locked',
      tries: 0,
      theoryAce: false,
      selectedSlotIndex: p.stages[i]!.faultySlotIndex,
      currentValue: p.stages[i]!.sabotagedValue,
    };
  });
  return {
    dateIso: p.dateIso,
    stage: 0,
    layers,
    values: cloneValues(p.broken),
    cadenceIdx: p.cadenceFault.sabotagedIndex,
    pendingTheory: null,
    theory: { melody: null, chords: null, bass: null, cadence: null },
    labelsSeen: false,
  };
}

export const activeLayer = (s: GameState): LayerId | null => (s.stage < 4 ? LAYERS[s.stage]! : null);
export const isVictory = (s: GameState): boolean => s.stage >= 4;

// --- Edits -------------------------------------------------------------------------

function refreshLabel(p: MendPuzzle, s: GameState, layer: LayerId): void {
  const k = p.groove.keyPc;
  const L = s.layers[layer];
  if (layer === 'melody') L.currentValue = midiName(s.values.melody[p.melodyFault.slot]!, k);
  if (layer === 'chords') L.currentValue = chordLabel(s.values.chords[p.chordFault.bar]!, k);
  if (layer === 'bass') L.currentValue = midiName(s.values.bass[p.bassFault.bar]!, k);
  if (layer === 'cadence') L.currentValue = p.cadenceFault.candidates[s.cadenceIdx]!.label;
}

/** Nudge the faulty melody note by ±1 semitone inside its ±2 window. Returns false at the edge. */
export function nudgeMelody(p: MendPuzzle, s: GameState, dir: 1 | -1): boolean {
  const f = p.melodyFault;
  const cur = s.values.melody[f.slot]!;
  const next = Math.min(f.max, Math.max(f.min, cur + dir));
  if (next === cur) return false;
  s.values.melody[f.slot] = next;
  refreshLabel(p, s, 'melody');
  return true;
}

export function stepChordRoot(p: MendPuzzle, s: GameState, dir: 1 | -1): void {
  const c = s.values.chords[p.chordFault.bar]!;
  s.values.chords[p.chordFault.bar] = { root: (c.root + dir + 12) % 12, quality: c.quality };
  refreshLabel(p, s, 'chords');
}

export function setChordQuality(p: MendPuzzle, s: GameState, quality: EditableQuality): void {
  const c = s.values.chords[p.chordFault.bar]!;
  s.values.chords[p.chordFault.bar] = { root: c.root, quality };
  refreshLabel(p, s, 'chords');
}

export function nudgeBass(p: MendPuzzle, s: GameState, dir: 1 | -1): boolean {
  const f = p.bassFault;
  const cur = s.values.bass[f.bar]!;
  const next = Math.min(f.max, Math.max(f.min, cur + dir));
  if (next === cur) return false;
  s.values.bass[f.bar] = next;
  refreshLabel(p, s, 'bass');
  return true;
}

export function setBass(p: MendPuzzle, s: GameState, midi: number): void {
  const f = p.bassFault;
  s.values.bass[f.bar] = Math.min(f.max, Math.max(f.min, midi));
  refreshLabel(p, s, 'bass');
}

export function pickCadence(p: MendPuzzle, s: GameState, idx: number): void {
  const opt = p.cadenceFault.candidates[idx];
  if (!opt) return;
  s.cadenceIdx = idx;
  s.values.chords[3] = { ...opt.chord };
  s.values.bass[3] = bassMidi(opt.chord.root);
  refreshLabel(p, s, 'cadence');
}

// --- Check Fix ---------------------------------------------------------------------

export function isCurrentFixCorrect(p: MendPuzzle, s: GameState): boolean {
  switch (activeLayer(s)) {
    case 'melody': return checkMelody(p, s.values.melody[p.melodyFault.slot]!);
    case 'chords': return checkChord(p, s.values.chords[p.chordFault.bar] as Chord);
    case 'bass': return checkBass(p, s.values.bass[p.bassFault.bar]!);
    case 'cadence': return checkCadence(p, s.cadenceIdx);
    default: return false;
  }
}

export interface CheckResult {
  layer: LayerId;
  ok: boolean;
  tries: number;
}

export function checkFix(p: MendPuzzle, s: GameState, labelsShown: boolean): CheckResult | null {
  const layer = activeLayer(s);
  if (!layer || s.pendingTheory) return null;
  const L = s.layers[layer];
  L.tries += 1;
  if (labelsShown) s.labelsSeen = true;
  const ok = isCurrentFixCorrect(p, s);
  if (ok) {
    L.status = L.tries === 1 ? 'healed' : 'patched';
    s.pendingTheory = layer;
  }
  return { layer, ok, tries: L.tries };
}

/** Answer the optional theory card; advances to the next stage. Returns correctness. */
export function answerTheory(p: MendPuzzle, s: GameState, optionIdx: number): boolean | null {
  const layer = s.pendingTheory;
  if (!layer) return null;
  const q = p.stages[LAYERS.indexOf(layer)]!.theoryBonus;
  const correct = optionIdx === q.correctIndex;
  s.theory[layer] = correct;
  s.layers[layer].theoryAce = correct;
  advance(s);
  return correct;
}

export function skipTheory(s: GameState): void {
  if (s.pendingTheory) advance(s);
}

function advance(s: GameState): void {
  s.pendingTheory = null;
  s.stage = Math.min(4, s.stage + 1);
  const next = activeLayer(s);
  if (next) s.layers[next].status = 'active';
}

// --- Summary -----------------------------------------------------------------------

export function summarize(p: MendPuzzle, s: GameState): MendSummary {
  const layers = LAYERS.map((id) => ({ ...s.layers[id] }));
  const totalTaps = layers.reduce((a, l) => a + Math.max(1, l.tries), 0);
  const theoryAces = layers.filter((l) => l.theoryAce).length;
  const clean = totalTaps === 4;
  let stampId: StampId = 'track-restored';
  if (clean && !s.labelsSeen) stampId = 'golden-ears';
  else if (clean) stampId = 'chief-surgeon';
  else if (theoryAces === 4) stampId = 'theory-ace';
  return { puzzleNumber: p.puzzleNumber, totalTaps, theoryAces, stampId, layers };
}

/** Every seal a finished run earns (the summary stamp is the headline one). */
export function sealsEarned(summary: MendSummary): StampId[] {
  const out: StampId[] = ['track-restored'];
  if (summary.totalTaps === 4) out.push('chief-surgeon');
  if (summary.theoryAces === 4) out.push('theory-ace');
  if (summary.stampId === 'golden-ears') out.push('golden-ears');
  return out;
}

export const STAMP_TITLE: Record<StampId, string> = {
  'chief-surgeon': 'Chief Surgeon!',
  'track-restored': 'Track Restored!',
  'theory-ace': 'Theory Ace!',
  'golden-ears': 'Golden Ears!',
};
