/**
 * Dissonance validator: one objective rule per stage, plus the full control space the
 * player can reach. The sabotage engine only ships a day when, for every stage, exactly
 * one reachable state passes the rule (tests/puzzle.test.ts checks 365 days).
 *
 *  Stage 1 (melody):  the repaired note is a chord tone of its bar (in key, no rub).
 *  Stage 2 (chords):  the chord stands on the bar's bass as its root, stays in key, and
 *                     contains every melody note sung in that bar.
 *  Stage 3 (bass):    the bass plays the root of the healed chord.
 *  Stage 4 (cadence): the chosen bar-4 chord delivers the displayed target mood.
 */
import type { Chord, Groove, MendPuzzle } from '../types';
import { EDITABLE_QUALITIES, chordPcs, isChordTone, isDiatonic, pc } from './theory';

export function melodyPcsInBar(groove: Groove, bar: number): number[] {
  return groove.melody.filter((n) => Math.floor(n.start / 16) === bar).map((n) => pc(n.midi));
}

// --- Pure rules (shared by the generator and the game) -----------------------

export function melodyRule(groove: Groove, bar: number, midi: number): boolean {
  return isDiatonic(midi, groove.keyPc) && isChordTone(midi, groove.chords[bar]!);
}

export function chordRule(groove: Groove, bar: number, chord: Chord): boolean {
  const tones = chordPcs(chord);
  return (
    chord.root === pc(groove.bass[bar]!) &&
    tones.every((t) => isDiatonic(t, groove.keyPc)) &&
    melodyPcsInBar(groove, bar).every((m) => tones.includes(m))
  );
}

export function bassRule(groove: Groove, bar: number, midi: number): boolean {
  return pc(midi) === groove.chords[bar]!.root;
}

// --- Control spaces ----------------------------------------------------------

export function range(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

export function chordControlSpace(): Chord[] {
  const out: Chord[] = [];
  for (let root = 0; root < 12; root++) for (const quality of EDITABLE_QUALITIES) out.push({ root, quality });
  return out;
}

// --- Stage checks used by the game --------------------------------------------

export function checkMelody(p: MendPuzzle, midi: number): boolean {
  const f = p.melodyFault;
  return midi >= f.min && midi <= f.max && melodyRule(p.groove, f.bar, midi);
}

export function checkChord(p: MendPuzzle, chord: Chord): boolean {
  return chordRule(p.groove, p.chordFault.bar, chord);
}

export function checkBass(p: MendPuzzle, midi: number): boolean {
  const f = p.bassFault;
  return midi >= f.min && midi <= f.max && bassRule(p.groove, f.bar, midi);
}

export function checkCadence(p: MendPuzzle, idx: number): boolean {
  return p.cadenceFault.candidates[idx]?.category === p.cadenceFault.mood;
}

/** Every state in each stage's control space that passes its rule (must be exactly one). */
export function acceptedStates(p: MendPuzzle): { melody: number[]; chords: Chord[]; bass: number[]; cadence: number[] } {
  return {
    melody: range(p.melodyFault.min, p.melodyFault.max).filter((m) => checkMelody(p, m)),
    chords: chordControlSpace().filter((c) => checkChord(p, c)),
    bass: range(p.bassFault.min, p.bassFault.max).filter((m) => checkBass(p, m)),
    cadence: p.cadenceFault.candidates.map((_, i) => i).filter((i) => checkCadence(p, i)),
  };
}
