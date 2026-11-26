/** UTC-date → puzzle number / seed. Every player worldwide gets the same MEND #N. */
import { hashString } from './rng';

/** MEND #1 shipped on this UTC date. */
export const EPOCH_ISO = '2026-10-07';
const DAY_MS = 86_400_000;

export function utcDateIso(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function isoToUtcMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

export function addDaysIso(iso: string, days: number): string {
  return utcDateIso(new Date(isoToUtcMs(iso) + days * DAY_MS));
}

/** Whole days from `a` to `b` (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((isoToUtcMs(b) - isoToUtcMs(a)) / DAY_MS);
}

export function puzzleNumberFor(iso: string): number {
  return daysBetween(EPOCH_ISO, iso) + 1;
}

export function seedFor(iso: string): number {
  return hashString(`MEND|${iso}`);
}
