/**
 * Recorded Rhodes samples shared with Reharm: FluidR3_GM electric_piano_1 per-note MP3s
 * (CC BY 3.0, via gleitz/midi-js-soundfonts), a minor third apart; Tone's Sampler repitches between them.
 */
const FILES = import.meta.glob('../../assets/samples/rhodes/*.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

const PC: Record<string, number> = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };

/** "Eb4" -> 63. */
export function noteToMidi(name: string): number | null {
  const m = /^([A-G]b?)(-?\d)$/.exec(name);
  if (!m || PC[m[1]!] === undefined) return null;
  return (Number(m[2]) + 1) * 12 + PC[m[1]!]!;
}

/** MIDI note -> file URL for the Rhodes set. */
export function rhodesSampleUrls(): Map<number, string> {
  const out = new Map<number, string>();
  for (const [path, url] of Object.entries(FILES)) {
    const m = /\/([^/]+)\.mp3$/.exec(path);
    const midi = m ? noteToMidi(m[1]!) : null;
    if (midi !== null) out.set(midi, url);
  }
  return out;
}
