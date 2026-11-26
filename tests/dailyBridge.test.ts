import { describe, expect, it } from 'vitest';
import { localDateIso, puzzleNumberFor } from '../src/core/daily';
import { generatePuzzle } from '../src/core/puzzle';
import {
  DAILY_KEY,
  bestTapsFrom,
  buildDoneRecord,
  buildProgressRecord,
  emitDaily,
  labMoveFor,
  shouldReplace,
  type DailyStats,
} from '../src/game/daily';
import { checkFix, newGame, summarize } from '../src/game/state';
import { defaultSave, recordWin, type KeyValueStore } from '../src/game/storage';

// 23:30 local on Nov 26 (Date(y, m, d, h, min) is local time).
const lateNight = new Date(2026, 10, 26, 23, 30);
const stats: DailyStats = { streak: 3, bestTaps: 4, played: 8 };

function memKV(): KeyValueStore & { dump(): string | null } {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), dump: () => m.get(DAILY_KEY) ?? null };
}

const puzzle = generatePuzzle('2026-11-26');

function restored() {
  const s = newGame(puzzle);
  s.stage = 4;
  for (const l of Object.values(s.layers)) {
    l.status = 'healed';
    l.tries = 1;
  }
  return s;
}

describe('local day key', () => {
  it('rolls over at local midnight, not UTC', () => {
    expect(localDateIso(new Date(2026, 10, 26, 0, 1))).toBe('2026-11-26');
    expect(localDateIso(new Date(2026, 10, 25, 23, 59))).toBe('2026-11-25');
    expect(puzzleNumberFor(localDateIso(lateNight))).toBe(puzzle.puzzleNumber);
  });
});

describe('buildDoneRecord', () => {
  it('records a clean restore for the hub', () => {
    const summary = summarize(puzzle, restored());
    const r = buildDoneRecord(puzzle, summary, stats, lateNight);
    expect(r).toMatchObject({
      v: 1,
      gameId: 'mend',
      dateKey: '2026-11-26',
      puzzleNo: puzzle.puzzleNumber,
      status: 'done',
      score: 4,
      scoreLabel: '4 taps · 0⭐',
      streak: 3,
      bestScore: 4,
      playedCount: 8,
      shareText: '🩺 MEND: 4 taps · 0/4 ⭐',
      updatedAt: lateNight.getTime(),
    });
    expect(JSON.stringify(r).length).toBeLessThan(2048);
  });

  it('links the Lydian lab move only on a Lydian cadence day', () => {
    const lydian = { ...puzzle, cadenceFault: { ...puzzle.cadenceFault, mood: 'lydian' as const } };
    const other = { ...puzzle, cadenceFault: { ...puzzle.cadenceFault, mood: 'authentic' as const } };
    expect(labMoveFor(lydian)).toEqual({ slug: 'lydian-sharp4', label: 'Lydian #4' });
    expect(labMoveFor(other)).toBeNull();
  });
});

describe('buildProgressRecord', () => {
  it('is new before any check', () => {
    expect(buildProgressRecord(puzzle, newGame(puzzle), stats, lateNight).status).toBe('new');
  });

  it('is in_progress after a failed attempt or a healed layer', () => {
    const s = newGame(puzzle);
    s.layers.melody.tries = 1;
    expect(buildProgressRecord(puzzle, s, stats, lateNight)).toMatchObject({ status: 'in_progress', progressLabel: '0/4 layers' });
    s.layers.melody.status = 'healed';
    s.layers.chords.status = 'active';
    expect(buildProgressRecord(puzzle, s, stats, lateNight)).toMatchObject({ status: 'in_progress', progressLabel: '1/4 layers' });
  });

  it('follows real play: a wrong check starts the day', () => {
    const s = newGame(puzzle);
    checkFix(puzzle, s, true);
    expect(buildProgressRecord(puzzle, s, stats, lateNight).status).toBe('in_progress');
  });
});

describe('bestTapsFrom', () => {
  it('reads the fewest taps from the histogram', () => {
    expect(bestTapsFrom({ tapDist: [0, 0, 0, 0, 0] })).toBeNull();
    expect(bestTapsFrom({ tapDist: [0, 2, 1, 0, 0] })).toBe(5);
    expect(bestTapsFrom({ tapDist: [1, 0, 0, 0, 0] })).toBe(4);
  });

  it('matches recordWin', () => {
    const next = recordWin(defaultSave().stats, '2026-11-26', summarize(puzzle, restored()));
    expect(bestTapsFrom(next)).toBe(4);
  });
});

describe('shouldReplace / emitDaily', () => {
  const done = buildDoneRecord(puzzle, summarize(puzzle, restored()), stats, lateNight);
  const s = newGame(puzzle);
  s.layers.melody.tries = 1;
  const prog = buildProgressRecord(puzzle, s, stats, lateNight);

  it('never regresses a finished local day', () => {
    expect(shouldReplace(done, prog)).toBe(false);
    expect(shouldReplace(done, buildProgressRecord(puzzle, newGame(puzzle), stats, lateNight))).toBe(false);
  });

  it('writes progress over an older day but not an empty "new"', () => {
    const yesterday = { ...done, dateKey: '2026-11-25' };
    expect(shouldReplace(yesterday, prog)).toBe(true);
    expect(shouldReplace(yesterday, buildProgressRecord(puzzle, newGame(puzzle), stats, lateNight))).toBe(false);
    expect(shouldReplace(null, buildProgressRecord(puzzle, newGame(puzzle), stats, lateNight))).toBe(false);
  });

  it('writes daily:v1:mend and survives a throwing backend', () => {
    const kv = memKV();
    emitDaily(prog, kv);
    expect(JSON.parse(kv.dump()!)).toMatchObject({ status: 'in_progress', gameId: 'mend' });
    emitDaily(done, kv);
    expect(JSON.parse(kv.dump()!).status).toBe('done');
    emitDaily(prog, kv);
    expect(JSON.parse(kv.dump()!).status).toBe('done');

    const bad: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(() => emitDaily(done, bad)).not.toThrow();
    expect(() => emitDaily(done, null)).not.toThrow();
  });
});
