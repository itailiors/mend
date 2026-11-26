import { describe, expect, it } from 'vitest';
import { addDaysIso, puzzleNumberFor, seedFor, utcDateIso } from '../src/core/daily';
import { generatePuzzle } from '../src/core/puzzle';
import { createRng } from '../src/core/rng';
import { chordPcs, intervalClass, isChordTone, isDiatonic, pc, sameChord, semitoneRub } from '../src/core/theory';
import { acceptedStates, checkBass, checkCadence, checkChord, checkMelody, melodyPcsInBar } from '../src/core/validator';

const START = '2026-11-26';
const DAYS = Array.from({ length: 365 }, (_, i) => addDaysIso(START, i));

describe('deterministic daily seed', () => {
  it('maps UTC dates to stable puzzle numbers', () => {
    expect(puzzleNumberFor('2026-10-07')).toBe(1);
    expect(puzzleNumberFor('2026-11-26')).toBe(51);
    expect(utcDateIso(new Date('2026-11-26T23:59:59Z'))).toBe('2026-11-26');
    expect(utcDateIso(new Date('2026-11-27T00:00:00+05:00'))).toBe('2026-11-26');
  });

  it('spells scale degrees to agree with note names', async () => {
    const { degreeLabel } = await import('../src/core/theory');
    expect(degreeLabel(61, 0)).toBe('#1'); // C# in C
    expect(degreeLabel(63, 0)).toBe('#2'); // D# in C (sharp spelling)
    expect(degreeLabel(65, 2)).toBe('b3'); // F in D
    expect(degreeLabel(61, 10)).toBe('b3'); // Db in Bb
    expect(degreeLabel(66, 0)).toBe('#4'); // F# in C
  });

  it('gives every date its own seed and the same PRNG stream everywhere', () => {
    const seeds = new Set(DAYS.map(seedFor));
    expect(seeds.size).toBe(DAYS.length);
    const a = createRng(seedFor(START));
    const b = createRng(seedFor(START));
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
  });

  it('regenerates an identical puzzle for the same date', () => {
    const p1 = generatePuzzle('2027-03-14');
    const p2 = JSON.parse(JSON.stringify(p1));
    expect(JSON.stringify(generatePuzzle('2027-03-14'))).toBe(JSON.stringify(p2));
  });

  it('varies keys, tempos and progressions across the year', () => {
    const ps = DAYS.map(generatePuzzle);
    expect(new Set(ps.map((p) => p.groove.keyPc)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(ps.map((p) => p.bpm)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(ps.map((p) => p.groove.romans.join(' '))).size).toBeGreaterThanOrEqual(40);
    expect(new Set(ps.map((p) => p.cadenceFault.mood)).size).toBe(7);
  });
});

describe.each(DAYS)('MEND %s', (day) => {
  const p = generatePuzzle(day);
  const g = p.groove;

  it('is a consonant groove before sabotage', () => {
    expect(g.melody).toHaveLength(8);
    g.melody.forEach((n) => {
      const bar = Math.floor(n.start / 16);
      expect(isChordTone(n.midi, g.chords[bar]!)).toBe(true);
    });
    g.chords.forEach((c, bar) => expect(pc(g.bass[bar]!)).toBe(c.root));
    g.chords.slice(0, 3).forEach((c) => chordPcs(c).forEach((t) => expect(isDiatonic(t, g.keyPc)).toBe(true)));
  });

  it('puts stages 1–3 on three different bars and stage 4 on bar 4', () => {
    const bars = [p.melodyFault.bar, p.chordFault.bar, p.bassFault.bar];
    expect(new Set(bars).size).toBe(3);
    bars.forEach((b) => expect(b).toBeLessThan(3));
    expect(p.stages[3].faultySlotIndex).toBe(3);
    expect(p.stages[3].targetMoodPill).toBeTruthy();
  });

  it('stage 1: sabotage is an out-of-key semitone rub within ±2 of the target', () => {
    const f = p.melodyFault;
    expect(Math.abs(f.sabotaged - f.target)).toBeGreaterThanOrEqual(1);
    expect(Math.abs(f.sabotaged - f.target)).toBeLessThanOrEqual(2);
    expect(isDiatonic(f.sabotaged, g.keyPc)).toBe(false);
    expect(semitoneRub(f.sabotaged, chordPcs(g.chords[f.bar]!))).not.toBeNull();
    expect(p.broken.melody[f.slot]).toBe(f.sabotaged);
  });

  it('stage 2: broken chord rubs a melody note in its bar', () => {
    const f = p.chordFault;
    const melody = melodyPcsInBar(g, f.bar);
    expect(sameChord(f.sabotaged, f.target)).toBe(false);
    expect(chordPcs(f.sabotaged).some((t) => melody.some((m) => intervalClass(t, m) === 1))).toBe(true);
  });

  it('stage 3: broken bass is a non-chord tone rubbing the healed chord', () => {
    const f = p.bassFault;
    const chord = g.chords[f.bar]!;
    expect(isChordTone(f.sabotaged, chord)).toBe(false);
    expect(semitoneRub(f.sabotaged, chordPcs(chord))).not.toBeNull();
  });

  it('stage validators reject the sabotage and accept exactly one state (the target)', () => {
    expect(checkMelody(p, p.melodyFault.sabotaged)).toBe(false);
    expect(checkChord(p, p.chordFault.sabotaged)).toBe(false);
    expect(checkBass(p, p.bassFault.sabotaged)).toBe(false);
    expect(checkCadence(p, p.cadenceFault.sabotagedIndex)).toBe(false);

    const acc = acceptedStates(p);
    expect(acc.melody).toEqual([p.melodyFault.target]);
    expect(acc.chords).toHaveLength(1);
    expect(sameChord(acc.chords[0]!, p.chordFault.target)).toBe(true);
    expect(acc.bass).toEqual([p.bassFault.target]);
    expect(acc.cadence).toEqual([p.cadenceFault.correctIndex]);
  });

  it('stage 4 offers four distinct chords with one per mood category', () => {
    const c = p.cadenceFault.candidates;
    expect(c).toHaveLength(4);
    expect(new Set(c.map((o) => o.label)).size).toBe(4);
    expect(c.filter((o) => o.category === p.cadenceFault.mood)).toHaveLength(1);
    expect(sameChord(c[p.cadenceFault.correctIndex]!.chord, g.chords[3]!)).toBe(true);
  });

  it('chip and nudge ranges reach the target', () => {
    const b = p.bassFault;
    for (const m of [b.chips.root, b.chips.third, b.chips.fifth, b.sabotaged, b.target]) {
      expect(m).toBeGreaterThanOrEqual(b.min);
      expect(m).toBeLessThanOrEqual(b.max);
    }
    const m = p.melodyFault;
    expect(m.target).toBeGreaterThanOrEqual(m.min);
    expect(m.target).toBeLessThanOrEqual(m.max);
  });

  it('has a well-formed theory bonus for every stage', () => {
    for (const s of p.stages) {
      const q = s.theoryBonus;
      expect(new Set(q.options).size).toBe(3);
      expect([0, 1, 2]).toContain(q.correctIndex);
      expect(q.shareTag.length).toBeGreaterThan(0);
      expect(q.prompt.length).toBeGreaterThan(0);
    }
  });
});
