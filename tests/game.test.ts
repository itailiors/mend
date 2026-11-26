import { describe, expect, it } from 'vitest';
import { generatePuzzle } from '../src/core/puzzle';
import { buildSteps } from '../src/audio/arrangement';
import { buildShare } from '../src/game/share';
import {
  type GameState, answerTheory, checkFix, isVictory, newGame, nudgeBass, nudgeMelody, pickCadence, setBass,
  setChordQuality, skipTheory, stepChordRoot, summarize,
} from '../src/game/state';
import { type KeyValueStore, defaultSave, displayStreak, loadSave, recordWin, writeSave } from '../src/game/storage';
import type { EditableQuality, MendPuzzle } from '../src/types';

type S = GameState;

/** Solve every stage cleanly with the validator's unique answers. */
function solve(p: MendPuzzle, s: S, opts: { wrongFirst?: boolean; aceTheory?: boolean } = {}): void {
  // Stage 1
  if (opts.wrongFirst) {
    expect(checkFix(p, s, true)!.ok).toBe(false);
  }
  const f = p.melodyFault;
  while (s.values.melody[f.slot]! !== f.target) nudgeMelody(p, s, f.target > s.values.melody[f.slot]! ? 1 : -1);
  expect(checkFix(p, s, true)!.ok).toBe(true);
  if (opts.aceTheory) answerTheory(p, s, p.stages[0].theoryBonus.correctIndex);
  else skipTheory(s);
  // Stage 2
  const t = p.chordFault.target;
  while (s.values.chords[p.chordFault.bar]!.root !== t.root) stepChordRoot(p, s, 1);
  setChordQuality(p, s, t.quality as EditableQuality);
  expect(checkFix(p, s, true)!.ok).toBe(true);
  if (opts.aceTheory) answerTheory(p, s, p.stages[1].theoryBonus.correctIndex);
  else skipTheory(s);
  // Stage 3
  setBass(p, s, p.bassFault.chips.root);
  expect(checkFix(p, s, true)!.ok).toBe(true);
  if (opts.aceTheory) answerTheory(p, s, p.stages[2].theoryBonus.correctIndex);
  else skipTheory(s);
  // Stage 4
  pickCadence(p, s, p.cadenceFault.correctIndex);
  expect(checkFix(p, s, true)!.ok).toBe(true);
  if (opts.aceTheory) answerTheory(p, s, p.stages[3].theoryBonus.correctIndex);
  else skipTheory(s);
}

describe('accordion state machine', () => {
  const p = generatePuzzle('2026-11-26');

  it('starts on Stage 1 with the broken track', () => {
    const s = newGame(p);
    expect(s.stage).toBe(0);
    expect(s.layers.melody.status).toBe('active');
    expect(s.layers.chords.status).toBe('locked');
    expect(s.values).toEqual(p.broken);
  });

  it('counts wrong attempts and marks a multi-try fix as patched', () => {
    const s = newGame(p);
    solve(p, s, { wrongFirst: true });
    expect(s.layers.melody.tries).toBe(2);
    expect(s.layers.melody.status).toBe('patched');
    expect(s.layers.chords.status).toBe('healed');
    expect(isVictory(s)).toBe(true);
    const sum = summarize(p, s);
    expect(sum.totalTaps).toBe(5);
    expect(sum.stampId).toBe('track-restored');
  });

  it('restores exactly the clean track after a full solve', () => {
    const s = newGame(p);
    solve(p, s);
    expect(s.values).toEqual(p.restored);
  });

  it('awards Chief Surgeon for 4/4 clean and Theory Ace stars', () => {
    const s = newGame(p);
    solve(p, s, { aceTheory: true });
    const sum = summarize(p, s);
    expect(sum.totalTaps).toBe(4);
    expect(sum.theoryAces).toBe(4);
    expect(sum.stampId).toBe('chief-surgeon');
  });

  it('awards Golden Ears when solved cleanly in Pure Ear mode', () => {
    const s = newGame(p);
    solve(p, s);
    s.labelsSeen = false; // solve() passes labelsShown=true; emulate a pure-ear run
    expect(summarize(p, s).stampId).toBe('golden-ears');
  });

  it('clamps nudges to the control window', () => {
    const s = newGame(p);
    for (let i = 0; i < 10; i++) nudgeMelody(p, s, 1);
    expect(s.values.melody[p.melodyFault.slot]).toBe(p.melodyFault.max);
    s.stage = 2;
    for (let i = 0; i < 20; i++) nudgeBass(p, s, -1);
    expect(s.values.bass[p.bassFault.bar]).toBe(p.bassFault.min);
  });

  it('ignores Check Fix while the theory card is pending', () => {
    const s = newGame(p);
    const f = p.melodyFault;
    while (s.values.melody[f.slot]! !== f.target) nudgeMelody(p, s, f.target > s.values.melody[f.slot]! ? 1 : -1);
    checkFix(p, s, true);
    expect(checkFix(p, s, true)).toBeNull();
    expect(s.layers.melody.tries).toBe(1);
  });
});

describe('share card', () => {
  it('matches the Bandle-adjacent diagnostic format', () => {
    const p = generatePuzzle('2026-11-26');
    const s = newGame(p);
    solve(p, s, { wrongFirst: true, aceTheory: true });
    const { shareText, headline } = buildShare(p, summarize(p, s));
    const lines = shareText.split('\n');
    expect(headline).toBe('🩺 MEND #51 — Track Restored!');
    expect(lines).toHaveLength(6);
    expect(lines[1]).toBe(`🎵 Melody   🟡 (2 tries) ⭐ ${p.stages[0].theoryBonus.shareTag}`);
    expect(lines[2]).toBe(`🎹 Chords   🟢 (1 try)  ⭐ ${p.stages[1].theoryBonus.shareTag}`);
    expect(lines[3]).toMatch(/^🎸 Bass {5}🟢 \(1 try\) {2}⭐ /);
    expect(lines[4]).toMatch(/^✨ Cadence {2}🟢 \(1 try\) {2}⭐ /);
    expect(lines[5]).toBe('Precision: 5/4 taps | Theory Aces: 4/4 ⭐');
  });
});

describe('persistence & streaks', () => {
  const mem = (): KeyValueStore & { data: Record<string, string> } => {
    const data: Record<string, string> = {};
    return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
  };

  it('round-trips settings and day state', () => {
    const kv = mem();
    const save = defaultSave();
    save.settings.theme = 'light';
    save.settings.noteLabels = 'ear-only';
    const p = generatePuzzle('2026-11-26');
    save.days[p.dateIso] = { state: newGame(p), summary: null };
    writeSave(save, kv);
    const back = loadSave(kv);
    expect(back.settings.theme).toBe('light');
    expect(back.settings.noteLabels).toBe('ear-only');
    expect(back.days[p.dateIso]!.state.values).toEqual(p.broken);
  });

  it('survives corrupt storage', () => {
    const kv = mem();
    kv.setItem('mend:v1', '{not json');
    expect(loadSave(kv).settings.theme).toBe('dark');
  });

  it('extends streaks on consecutive days and resets after a gap', () => {
    const p = generatePuzzle('2026-11-26');
    const s = newGame(p);
    solve(p, s);
    const sum = summarize(p, s);
    let st = defaultSave().stats;
    st = recordWin(st, '2026-11-26', sum);
    st = recordWin(st, '2026-11-27', sum);
    st = recordWin(st, '2026-11-27', sum); // same day twice is ignored
    expect(st.currentStreak).toBe(2);
    expect(st.played).toBe(2);
    expect(displayStreak(st, '2026-11-28')).toBe(2);
    expect(displayStreak(st, '2026-11-29')).toBe(0);
    st = recordWin(st, '2026-11-30', sum);
    expect(st.currentStreak).toBe(1);
    expect(st.bestStreak).toBe(2);
    expect(st.seals).toContain('chief-surgeon');
    expect(st.tapDist[0]).toBe(3);
  });
});

describe('arrangement', () => {
  it('schedules every layer across the 64-step loop and follows edits', () => {
    const p = generatePuzzle('2026-11-26');
    const broken = buildSteps(p.groove, p.broken).flat();
    const fixed = buildSteps(p.groove, p.restored).flat();
    for (const v of ['melody', 'chords', 'bass', 'kick', 'snare', 'hat']) expect(broken.some((e) => e.voice === v)).toBe(true);
    const mel = (evs: typeof broken) => evs.filter((e) => e.voice === 'melody').map((e) => e.midis[0]);
    expect(mel(broken)).toContain(p.melodyFault.sabotaged);
    expect(mel(fixed)).not.toContain(p.melodyFault.sabotaged);
  });
});
