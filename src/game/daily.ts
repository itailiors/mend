/**
 * Reharm Daily hub record (`daily:v1:mend`).
 * Contract: ReharmLab-Dailys/design/data-contract.md §1; parsed by the hub's src/lib/records.ts.
 * The hub rolls over at LOCAL midnight; `dateKey` is the local calendar date, the same day
 * MEND's puzzle number is derived from (see localDateIso in core/daily.ts).
 */
import type { MendPuzzle, MendSummary, StampId } from '../types';
import { LAYERS } from '../types';
import type { GameState } from './state';
import type { KeyValueStore, Stats } from './storage';
import { displayStreak } from './storage';

export const DAILY_KEY = 'daily:v1:mend';
export const DAILY_HUB_URL = 'https://itailiors.github.io/reharm-daily/';
export const DAILY_SHARE_URL = `${DAILY_HUB_URL}?open=share`;
export const LAB_BASE_URL = 'https://itailiors.github.io/reharm-lab/';
export const LAB_CHANGES_URL = `${LAB_BASE_URL}?mode=changes&from=reharm-daily`;

export type DailyStatus = 'new' | 'in_progress' | 'done';

export interface LabMove {
  slug: string;
  label: string;
}

export interface DailyRecord {
  v: 1;
  gameId: 'mend';
  dateKey: string;
  puzzleNo: number;
  status: DailyStatus;
  score: number | null;
  scoreLabel: string;
  tierIcon?: string;
  streak: number;
  bestScore: number | null;
  playedCount: number;
  progressLabel?: string;
  shareText?: string;
  labMove?: LabMove | null;
  updatedAt: number;
}

export interface DailyStats {
  /** Streak as shown today (already broken if the last win is older than yesterday). */
  streak: number;
  /** Fewest taps in any restored track (lower is better), or null before the first win. */
  bestTaps: number | null;
  played: number;
}

const STAMP_ICON: Record<StampId, string> = {
  'golden-ears': '👂',
  'chief-surgeon': '🩺',
  'theory-ace': '⭐',
  'track-restored': '✅',
};

export const LYDIAN_SHARP4: LabMove = { slug: 'lydian-sharp4', label: 'Lydian #4' };

export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Fewest taps ever, from the tap histogram (index 0 = 4 taps … 4 = 8+). */
export function bestTapsFrom(stats: Pick<Stats, 'tapDist'>): number | null {
  const i = stats.tapDist.findIndex((n) => n > 0);
  return i < 0 ? null : 4 + i;
}

export function dailyStatsOf(stats: Stats, dateIso: string): DailyStats {
  return { streak: displayStreak(stats, dateIso), bestTaps: bestTapsFrom(stats), played: stats.played };
}

/** Lab move to teach: today's Lydian cadence, once restored. */
export function labMoveFor(p: MendPuzzle): LabMove | null {
  return p.cadenceFault.mood === 'lydian' ? { ...LYDIAN_SHARP4 } : null;
}

export function labMoveUrl(move: LabMove): string {
  return `${LAB_BASE_URL}?move=${encodeURIComponent(move.slug)}&from=mend`;
}

function base(p: MendPuzzle, stats: DailyStats, now: Date) {
  return {
    v: 1 as const,
    gameId: 'mend' as const,
    dateKey: localDateKey(now),
    puzzleNo: p.puzzleNumber,
    streak: Math.max(0, stats.streak),
    bestScore: stats.bestTaps,
    playedCount: stats.played,
    updatedAt: now.getTime(),
  };
}

export function buildDoneRecord(p: MendPuzzle, summary: MendSummary, stats: DailyStats, now: Date = new Date()): DailyRecord {
  return {
    ...base(p, stats, now),
    status: 'done',
    score: summary.totalTaps,
    scoreLabel: `${summary.totalTaps} taps · ${summary.theoryAces}⭐`,
    tierIcon: STAMP_ICON[summary.stampId],
    shareText: `🩺 MEND: ${summary.totalTaps} taps · ${summary.theoryAces}/4 ⭐`,
    labMove: labMoveFor(p),
  };
}

/** Layers fixed so far; a fix attempt before the first heal still counts as started. */
export function buildProgressRecord(p: MendPuzzle, s: GameState, stats: DailyStats, now: Date = new Date()): DailyRecord {
  const fixed = LAYERS.filter((id) => s.layers[id].status === 'healed' || s.layers[id].status === 'patched').length;
  const started = fixed > 0 || LAYERS.some((id) => s.layers[id].tries > 0);
  if (!started) return { ...base(p, stats, now), status: 'new', score: null, scoreLabel: '' };
  const label = `${fixed}/${LAYERS.length} layers`;
  return { ...base(p, stats, now), status: 'in_progress', score: null, scoreLabel: label, progressLabel: label };
}

/**
 * Whether `next` may replace `prev`. A finished local day never regresses to in_progress/new:
 * guards edge cases such as a device clock / time-zone change mid-day serving a new puzzle.
 */
export function shouldReplace(prev: Partial<DailyRecord> | null, next: DailyRecord): boolean {
  if (next.status === 'done') return true;
  if (!prev || prev.dateKey !== next.dateKey) return next.status === 'in_progress';
  if (prev.status === 'done') return false;
  if (next.status === 'new') return prev.puzzleNo === next.puzzleNo;
  return true;
}

export function loadDaily(kv: KeyValueStore | null): Partial<DailyRecord> | null {
  if (!kv) return null;
  try {
    const raw = kv.getItem(DAILY_KEY);
    return raw ? (JSON.parse(raw) as Partial<DailyRecord>) : null;
  } catch {
    return null;
  }
}

/** Mirror today's state into `daily:v1:mend` for the hub. Never touches `mend:v1`. */
export function emitDaily(next: DailyRecord, kv: KeyValueStore | null): void {
  if (!kv || !shouldReplace(loadDaily(kv), next)) return;
  try {
    kv.setItem(DAILY_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode: the game still works */
  }
}
