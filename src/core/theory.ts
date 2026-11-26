/** Pitch, scale and chord math. Pure functions, no randomness. */
import type { Chord, EditableQuality, Quality } from '../types';

export const pc = (midi: number): number => ((midi % 12) + 12) % 12;

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Keys spelled with flats (F, Bb, Eb, Ab). Everything else uses sharps. */
const FLAT_KEYS = new Set([5, 10, 3, 8]);

export function noteName(pitchClass: number, keyPc: number): string {
  return (FLAT_KEYS.has(keyPc) ? FLAT_NAMES : SHARP_NAMES)[pc(pitchClass)]!;
}

export function midiName(midi: number, keyPc: number): string {
  return `${noteName(midi, keyPc)}${Math.floor(midi / 12) - 1}`;
}

export function keyLabel(keyPc: number): string {
  return `${noteName(keyPc, keyPc)} Major`;
}

/** Compact telemetry form: "C MAJ", "EB MAJ". */
export function keyShort(keyPc: number): string {
  return `${noteName(keyPc, keyPc)} MAJ`;
}

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

export function scalePcs(keyPc: number): number[] {
  return MAJOR_STEPS.map((s) => (keyPc + s) % 12);
}

export function isDiatonic(pitch: number, keyPc: number): boolean {
  return MAJOR_STEPS.includes(pc(pitch - keyPc));
}

export const QUALITY_INTERVALS: Record<Quality, readonly number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  '7': [0, 4, 7, 10],
  dim: [0, 3, 6],
  sus: [0, 5, 7],
  'maj7#11': [0, 4, 7, 11, 6],
  m6: [0, 3, 7, 9],
};

export const EDITABLE_QUALITIES: readonly EditableQuality[] = ['maj', 'min', '7', 'dim', 'sus'];

/** Display text of each quality keycap. */
export const QUALITY_KEYCAP: Record<EditableQuality, string> = {
  maj: 'Maj',
  min: 'min',
  '7': '7',
  dim: 'dim',
  sus: 'sus',
};

export function chordPcs(chord: Chord): number[] {
  return QUALITY_INTERVALS[chord.quality].map((i) => (chord.root + i) % 12);
}

export function chordLabel(chord: Chord, keyPc: number): string {
  const r = noteName(chord.root, keyPc);
  switch (chord.quality) {
    case 'maj': return `${r} Maj`;
    case 'min': return `${r} min`;
    case '7': return `${r}7`;
    case 'dim': return `${r} dim`;
    case 'sus': return `${r} sus4`;
    case 'maj7#11': return `${r}maj7#11`;
    case 'm6': return `${r}m6`;
  }
}

export const sameChord = (a: Chord, b: Chord): boolean => a.root === b.root && a.quality === b.quality;

/** Interval class (0..6) between two pitches or pitch classes. */
export function intervalClass(a: number, b: number): number {
  const d = pc(a - b);
  return Math.min(d, 12 - d);
}

/**
 * The objectively grating interval: a semitone rub (minor 2nd / major 7th / minor 9th).
 * Returns the first pitch class in `against` that rubs `pitch`, or null.
 */
export function semitoneRub(pitch: number, against: readonly number[]): number | null {
  for (const p of against) if (intervalClass(pitch, p) === 1) return pc(p);
  return null;
}

export function isChordTone(pitch: number, chord: Chord): boolean {
  return chordPcs(chord).includes(pc(pitch));
}

/**
 * Scale degree of a pitch in a major key, spelled to agree with noteName():
 * C# in C → "#1", Eb in C → "b3", F in D → "b3".
 */
export function degreeLabel(pitch: number, keyPc: number): string {
  const LETTERS = 'CDEFGAB';
  const deg = (LETTERS.indexOf(noteName(pitch, keyPc)[0]!) - LETTERS.indexOf(noteName(keyPc, keyPc)[0]!) + 7) % 7;
  let diff = pc(pitch - keyPc) - MAJOR_STEPS[deg]!;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return `${diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff)}${deg + 1}`;
}

/** Flat spelling regardless of key (for borrowed-from-minor tones like b6). */
export function flatName(pitchClass: number): string {
  return FLAT_NAMES[pc(pitchClass)]!;
}

/** Name of the chord member a pitch class plays ("root", "3rd", …) or null. */
export function chordRole(pitch: number, chord: Chord): string | null {
  const iv = pc(pitch - chord.root);
  const idx = QUALITY_INTERVALS[chord.quality].indexOf(iv);
  if (idx < 0) return null;
  const roles: Record<number, string> = { 0: 'root', 3: 'b3rd', 4: '3rd', 5: '4th', 6: 'b5th', 7: '5th', 9: '6th', 10: 'b7th', 11: '7th' };
  if (chord.quality === 'maj7#11' && iv === 6) return '#11';
  return roles[iv] ?? null;
}

/**
 * Close-position voicing of a chord for the Rhodes (roughly F3..E5), root position
 * when it fits. Pure so the audio engine and tests agree on what sounds.
 */
export function voiceChord(chord: Chord): number[] {
  const ivs = QUALITY_INTERVALS[chord.quality];
  let base = 48 + chord.root; // C3..B3
  if (base < 53) base += 12; // keep the bottom note at F3 or above
  return ivs.map((i) => base + i).sort((a, b) => a - b);
}

/** Bass register MIDI (E1..D#2 → octave 2 region) for a pitch class. */
export function bassMidi(pitchClass: number): number {
  const m = 36 + pc(pitchClass); // C2..B2
  return m > 45 ? m - 12 : m; // fold A#2/B2 down so the bass sits low (A#1..A2)
}
