/** localStorage persistence: today's progress, streaks, clean-fix stats, seals, theme, label mode. */
import type { MendSummary, StampId } from '../types';
import { addDaysIso } from '../core/daily';
import type { GameState } from './state';
import { sealsEarned } from './state';

export type Theme = 'dark' | 'light';
export type NoteLabels = 'show' | 'ear-only';

export interface Settings {
  theme: Theme;
  noteLabels: NoteLabels;
  seenHelp: boolean;
}

export interface Stats {
  played: number;
  currentStreak: number;
  bestStreak: number;
  lastWinIso: string | null;
  cleanLayers: number;
  totalLayers: number;
  totalTaps: number;
  /** Runs by total taps: index 0 = 4 taps, 1 = 5, 2 = 6, 3 = 7, 4 = 8+. */
  tapDist: number[];
  theoryAces: number;
  seals: StampId[];
}

export interface DayRecord {
  state: GameState;
  summary: MendSummary | null;
}

export interface SaveData {
  version: 1;
  settings: Settings;
  stats: Stats;
  days: Record<string, DayRecord>;
}

const KEY = 'mend:v1';

export function defaultSave(): SaveData {
  return {
    version: 1,
    settings: { theme: 'dark', noteLabels: 'show', seenHelp: false },
    stats: { played: 0, currentStreak: 0, bestStreak: 0, lastWinIso: null, cleanLayers: 0, totalLayers: 0, totalTaps: 0, tapDist: [0, 0, 0, 0, 0], theoryAces: 0, seals: [] },
    days: {},
  };
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function store(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadSave(kv: KeyValueStore | null = store()): SaveData {
  const base = defaultSave();
  try {
    const raw = kv?.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== 1) return base;
    return {
      version: 1,
      settings: { ...base.settings, ...parsed.settings },
      stats: { ...base.stats, ...parsed.stats },
      days: parsed.days ?? {},
    };
  } catch {
    return base;
  }
}

export function writeSave(data: SaveData, kv: KeyValueStore | null = store()): void {
  try {
    // Keep the last 60 days of runs; stats carry the long-term history.
    const keys = Object.keys(data.days).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete data.days[k];
    kv?.setItem(KEY, JSON.stringify(data));
  } catch {
    /* private mode / quota: play on without persistence */
  }
}

/** Streak as displayed today (a missed day shows 0 until the next win). */
export function displayStreak(stats: Stats, todayIso: string): number {
  if (!stats.lastWinIso) return 0;
  if (stats.lastWinIso === todayIso || stats.lastWinIso === addDaysIso(todayIso, -1)) return stats.currentStreak;
  return 0;
}

/** Fold a finished run into the lifetime stats (idempotent per day via the caller). */
export function recordWin(stats: Stats, dateIso: string, summary: MendSummary): Stats {
  const s: Stats = { ...stats, tapDist: [...stats.tapDist], seals: [...stats.seals] };
  if (s.lastWinIso === dateIso) return s;
  s.played += 1;
  s.currentStreak = s.lastWinIso === addDaysIso(dateIso, -1) ? s.currentStreak + 1 : 1;
  s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
  s.lastWinIso = dateIso;
  s.totalLayers += 4;
  s.cleanLayers += summary.layers.filter((l) => l.tries <= 1).length;
  s.totalTaps += summary.totalTaps;
  s.tapDist[Math.min(4, summary.totalTaps - 4)]! += 1;
  s.theoryAces += summary.theoryAces;
  for (const seal of sealsEarned(summary)) if (!s.seals.includes(seal)) s.seals.push(seal);
  return s;
}
