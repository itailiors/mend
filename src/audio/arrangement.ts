/**
 * Pure step-sequencer arrangement: turns a groove + the current editable values into
 * 64 sixteenth-note steps of events. Rebuilt on every edit (cheap plain arrays, no
 * audio nodes), and read by the Tone.js scheduler one step at a time — so any edit is
 * heard from the next 16th, quantized for free.
 */
import type { Groove, TrackValues } from '../types';
import { voiceChord } from '../core/theory';

export const STEPS_PER_BAR = 16;
export const LOOP_STEPS = 64;
export const LOOP_BEATS = 16;

export type Voice = 'melody' | 'chords' | 'bass' | 'kick' | 'snare' | 'hat';

export interface StepEvent {
  voice: Voice;
  midis: number[];
  /** Length in 16th steps. */
  dur: number;
  vel: number;
}

export function buildSteps(g: Groove, v: TrackValues): StepEvent[][] {
  const steps: StepEvent[][] = Array.from({ length: LOOP_STEPS }, () => []);
  const add = (step: number, ev: StepEvent) => steps[step % LOOP_STEPS]!.push(ev);

  g.melody.forEach((n, i) => {
    add(n.start, { voice: 'melody', midis: [v.melody[i]!], dur: n.dur * 0.92, vel: n.start % 16 === 0 ? 0.82 : 0.7 });
  });

  for (let bar = 0; bar < 4; bar++) {
    const base = bar * STEPS_PER_BAR;
    const voicing = voiceChord(v.chords[bar]!);
    for (const h of g.comp) add(base + h.step, { voice: 'chords', midis: voicing, dur: h.dur, vel: h.vel ?? 0.62 });
    for (const h of g.bassPattern) add(base + h.step, { voice: 'bass', midis: [v.bass[bar]! + (h.offset ?? 0)], dur: h.dur * 0.9, vel: h.vel ?? 0.85 });

    const d = g.drums;
    for (const s of d.kick) add(base + s, { voice: 'kick', midis: [], dur: 2, vel: s === 0 ? 0.95 : 0.75 });
    for (const s of d.snare) add(base + s, { voice: 'snare', midis: [], dur: 2, vel: 0.8 });
    for (const s of d.hat) add(base + s, { voice: 'hat', midis: [], dur: 1, vel: d.hatAccent.includes(s) ? 0.75 : 0.42 });
    // Turnaround fill into the loop restart.
    if (bar === 3) {
      add(base + 14, { voice: 'snare', midis: [], dur: 1, vel: 0.45 });
      add(base + 15, { voice: 'snare', midis: [], dur: 1, vel: 0.6 });
    }
  }
  return steps;
}

/** 0.5 s silent 8-bit mono WAV data URI — played in the unlock tap to lift iOS into the media channel. */
export function makeSilentWavDataUri(sampleRate = 8000, seconds = 0.5): string {
  const samples = Math.max(1, Math.floor(sampleRate * seconds));
  const buf = new Uint8Array(44 + samples);
  const view = new DataView(buf.buffer);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) buf[off + i] = s.charCodeAt(i);
  };
  str(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  str(36, 'data');
  view.setUint32(40, samples, true);
  buf.fill(128, 44);
  let bin = '';
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!);
  return `data:audio/wav;base64,${btoa(bin)}`;
}
