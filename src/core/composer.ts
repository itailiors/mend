/**
 * 4-bar groove composer. Builds a clean, catchy loop from curated building blocks:
 * functional progressions × cadence moods × melodic rhythm/contour templates ×
 * comp, bass and drum grooves. Every melody note sits on a chord tone, so the
 * clean track is consonant by construction (the sabotage engine relies on that).
 */
import type { CadenceMood, Chord, DrumPattern, Groove, MelodyNote, PatternHit, Quality } from '../types';
import type { Rng } from './rng';
import { bassMidi, chordPcs, pc } from './theory';

export const KEYS = [0, 2, 3, 5, 7, 9, 10] as const; // C D Eb F G A Bb
export const BPM_MIN = 84;
export const BPM_MAX = 104;

/** Roman numeral → scale-step offset + quality (major key). */
export const ROMAN: Record<string, { step: number; quality: Quality }> = {
  I: { step: 0, quality: 'maj' },
  ii: { step: 2, quality: 'min' },
  iii: { step: 4, quality: 'min' },
  IV: { step: 5, quality: 'maj' },
  V: { step: 7, quality: 'maj' },
  V7: { step: 7, quality: '7' },
  vi: { step: 9, quality: 'min' },
  iv: { step: 5, quality: 'min' },
  'IVmaj7#11': { step: 5, quality: 'maj7#11' },
  iim6: { step: 2, quality: 'm6' },
};

export function romanChord(roman: string, keyPc: number): Chord {
  const r = ROMAN[roman];
  if (!r) throw new Error(`Unknown roman ${roman}`);
  return { root: (keyPc + r.step) % 12, quality: r.quality };
}

/** Bars 1–3 of curated functional progressions (bar 4 comes from the cadence mood). */
export const PROGRESSIONS: readonly (readonly [string, string, string])[] = [
  ['I', 'V', 'vi'], ['I', 'vi', 'IV'], ['I', 'IV', 'V'], ['I', 'ii', 'V'], ['I', 'iii', 'IV'],
  ['vi', 'IV', 'V'], ['I', 'V', 'IV'], ['I', 'vi', 'ii'], ['I', 'iii', 'vi'], ['vi', 'ii', 'V'],
  ['I', 'IV', 'ii'], ['IV', 'I', 'V'], ['I', 'vi', 'V'], ['vi', 'V', 'IV'], ['I', 'IV', 'vi'],
  ['IV', 'vi', 'V'], ['I', 'ii', 'IV'], ['vi', 'IV', 'I'], ['I', 'V', 'ii'], ['iii', 'vi', 'IV'],
  ['vi', 'iii', 'IV'], ['IV', 'V', 'vi'], ['ii', 'IV', 'V'], ['I', 'iii', 'ii'], ['IV', 'I', 'ii'],
  ['vi', 'I', 'V'], ['ii', 'vi', 'IV'], ['I', 'IV', 'I'], ['IV', 'ii', 'V'], ['vi', 'ii', 'IV'],
  ['I', 'vi', 'iii'], ['ii', 'V', 'vi'],
];

export interface MoodRule {
  label: string;
  /** Bar-3 functions (V7 counts as V) after which this cadence reads unambiguously. */
  after: readonly string[];
  target: string;
}

export const MOODS: Record<CadenceMood, MoodRule> = {
  authentic: { label: 'Authentic V → I Resolution', after: ['V'], target: 'I' },
  deceptive: { label: 'Deceptive V → vi Surprise', after: ['V'], target: 'vi' },
  plagal: { label: 'Plagal IV → I "Amen" Landing', after: ['IV'], target: 'I' },
  half: { label: 'Hanging Half Cadence on V', after: ['I', 'ii', 'iii', 'IV', 'vi'], target: 'V' },
  lydian: { label: 'Dreamy Lydian #4 Lift', after: ['I', 'ii', 'iii', 'V', 'vi'], target: 'IVmaj7#11' },
  dorian: { label: 'Warm Dorian ♮6', after: ['I', 'iii', 'IV', 'V', 'vi'], target: 'iim6' },
  borrowed: { label: 'Bittersweet Borrowed iv', after: ['I', 'ii', 'IV', 'vi'], target: 'iv' },
};

export const baseRoman = (r: string): string => (r === 'V7' ? 'V' : r);

/** Two notes per bar: [startStep, durSteps] inside a 16-step bar. */
const RHYTHMS: readonly (readonly [readonly [number, number], readonly [number, number]])[] = [
  [[0, 8], [8, 8]],
  [[0, 6], [6, 10]],
  [[0, 10], [10, 6]],
  [[0, 4], [6, 10]],
  [[2, 6], [8, 8]],
  [[0, 12], [12, 4]],
  [[0, 3], [3, 13]],
];
const CADENCE_RHYTHMS: readonly (readonly [readonly [number, number], readonly [number, number]])[] = [
  [[0, 6], [6, 10]],
  [[0, 4], [4, 12]],
  [[0, 8], [8, 8]],
];

/** Diatonic-step contour targets for the 6 notes of bars 1–3 (bar 4 is cadence-driven). */
const CONTOURS: readonly (readonly number[])[] = [
  [0, 2, 4, 5, 4, 2],
  [4, 2, 4, 7, 5, 4],
  [0, 1, 2, 4, 5, 4],
  [4, 2, 5, 3, 6, 4],
  [7, 6, 4, 5, 4, 2],
  [4, 2, 4, 2, 5, 3],
  [2, 4, 7, 4, 2, 1],
  [5, 4, 2, 4, 7, 6],
];

const COMPS: readonly PatternHit[][] = [
  [{ step: 0, dur: 15 }],
  [{ step: 0, dur: 6 }, { step: 6, dur: 10, vel: 0.5 }],
  [{ step: 0, dur: 3 }, { step: 6, dur: 3, vel: 0.5 }, { step: 10, dur: 6, vel: 0.55 }],
  [{ step: 0, dur: 7 }, { step: 8, dur: 7, vel: 0.5 }],
  [{ step: 0, dur: 10 }, { step: 10, dur: 2, vel: 0.45 }, { step: 12, dur: 4, vel: 0.5 }],
];

const BASSES: readonly PatternHit[][] = [
  [{ step: 0, dur: 6, offset: 0 }, { step: 6, dur: 2, offset: 0, vel: 0.6 }, { step: 8, dur: 6, offset: 0 }, { step: 14, dur: 2, offset: 12, vel: 0.55 }],
  [{ step: 0, dur: 10, offset: 0 }, { step: 10, dur: 6, offset: 7, vel: 0.65 }],
  [{ step: 0, dur: 4, offset: 0 }, { step: 6, dur: 4, offset: 0, vel: 0.7 }, { step: 10, dur: 2, offset: 12, vel: 0.55 }, { step: 12, dur: 4, offset: 0 }],
  [{ step: 0, dur: 14, offset: 0 }],
  [{ step: 0, dur: 3, offset: 0 }, { step: 3, dur: 5, offset: 0, vel: 0.65 }, { step: 8, dur: 3, offset: 7, vel: 0.6 }, { step: 11, dur: 5, offset: 0, vel: 0.7 }],
];

const EVENS = [0, 2, 4, 6, 8, 10, 12, 14];
const DRUMS: readonly DrumPattern[] = [
  { kick: [0, 10], snare: [4, 12], hat: EVENS, hatAccent: [0, 4, 8, 12] },
  { kick: [0, 7, 10], snare: [4, 12], hat: [2, 6, 10, 14], hatAccent: [2, 10] },
  { kick: [0, 8], snare: [4, 12], hat: EVENS, hatAccent: [2, 6, 10, 14] },
  { kick: [0, 3, 8, 11], snare: [4, 12], hat: EVENS, hatAccent: [0, 8] },
  { kick: [0, 6, 9], snare: [4, 12], hat: [0, 2, 3, 6, 8, 10, 11, 14], hatAccent: [0, 6, 10] },
];

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

function stepToMidi(tonic: number, step: number): number {
  const oct = Math.floor(step / 7);
  return tonic + oct * 12 + MAJOR_STEPS[((step % 7) + 7) % 7]!;
}

/** Chord tone of `chord` nearest `target` inside [lo, hi] (ties prefer moving away from `prev`). */
function nearestChordTone(chord: Chord, target: number, lo: number, hi: number, prev: number | null, pcs = chordPcs(chord)): number {
  let best = -1;
  let bestScore = Infinity;
  for (let m = lo; m <= hi; m++) {
    if (!pcs.includes(pc(m))) continue;
    const score = Math.abs(m - target) + (m === prev ? 0.5 : 0);
    if (score < bestScore) {
      best = m;
      bestScore = score;
    }
  }
  return best;
}

/** Melody tones the Stage 2 validator needs to pin the chord down (3rd, or b7 for dominant 7ths). */
export function identityInterval(quality: Quality): number {
  if (quality === '7') return 10;
  if (quality === 'min' || quality === 'm6') return 3;
  return 4;
}

/** Cadence-bar melody: [colour tone, landing tone] as intervals above the target chord root. */
const CADENCE_MELODY: Record<CadenceMood, [number, number]> = {
  authentic: [4, 0],
  plagal: [4, 0],
  deceptive: [3, 0],
  half: [4, 7],
  lydian: [6, 4],
  dorian: [9, 3],
  borrowed: [7, 0],
};

export function composeGroove(rng: Rng): Groove {
  const keyPc = rng.pick(KEYS);
  const bpm = BPM_MIN + 2 * rng.int((BPM_MAX - BPM_MIN) / 2 + 1);

  // --- Harmony -------------------------------------------------------------
  const prefix = [...rng.pick(PROGRESSIONS)] as string[];
  // Dominant bars sometimes become V7 (more pull, more colour).
  for (let i = 0; i < 3; i++) if (prefix[i] === 'V' && rng.chance(0.45)) prefix[i] = 'V7';
  const bar3 = baseRoman(prefix[2]!);
  const moods = (Object.keys(MOODS) as CadenceMood[]).filter((m) => MOODS[m].after.includes(bar3));
  const mood = rng.pick(moods);
  const romans = [...prefix, MOODS[mood].target] as [string, string, string, string];
  const chords = romans.map((r) => romanChord(r, keyPc)) as Groove['chords'];
  const bass = chords.map((c) => bassMidi(c.root)) as Groove['bass'];

  // --- Melody --------------------------------------------------------------
  let tonic = 60 + keyPc;
  if (tonic > 65) tonic -= 12; // keep the lead between ~G3 and ~A5
  const lo = tonic - 2;
  const hi = tonic + 16;
  const contour = rng.pick(CONTOURS);
  const rhythmA = rng.pick(RHYTHMS);
  const rhythmB = rng.chance(0.5) ? rhythmA : rng.pick(RHYTHMS);
  const rhythms = [rhythmA, rhythmB, rhythmA, rng.pick(CADENCE_RHYTHMS)];
  const melody: MelodyNote[] = [];
  let prev: number | null = null;
  for (let bar = 0; bar < 3; bar++) {
    const chord = chords[bar]!;
    const notes = [0, 1].map((k) => {
      const m = nearestChordTone(chord, stepToMidi(tonic, contour[bar * 2 + k]!), lo, hi, prev);
      prev = m;
      return m;
    });
    // Make sure the bar's identity tone (3rd / b7) is sung so the chord is unambiguous.
    const identity = (chord.root + identityInterval(chord.quality)) % 12;
    if (!notes.some((n) => pc(n) === identity)) {
      notes[1] = nearestChordTone(chord, notes[1]!, lo, hi, null, [identity]);
      prev = notes[1]!;
    }
    notes.forEach((midi, k) => {
      const [start, dur] = rhythms[bar]![k]!;
      melody.push({ midi, start: bar * 16 + start, dur });
    });
  }
  const cadChord = chords[3];
  const [colour, landing] = CADENCE_MELODY[mood];
  [colour, landing].forEach((iv, k) => {
    const target = k === 0 ? prev ?? tonic + 4 : melody[melody.length - 1]!.midi;
    const midi = nearestChordTone(cadChord, target, lo, hi, null, [(cadChord.root + iv) % 12]);
    const [start, dur] = rhythms[3]![k]!;
    melody.push({ midi, start: 48 + start, dur });
  });

  return {
    keyPc,
    bpm,
    romans,
    chords,
    bass,
    melody,
    comp: rng.pick(COMPS),
    bassPattern: rng.pick(BASSES),
    drums: rng.pick(DRUMS),
  };
}
