import { ApiError } from '@/api/client';
import type { EntryStatus } from '@/api/types';

/** 'YYYY-MM-DD' -> local Date at midnight (no UTC shift). */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDay(day: string): string {
  return parseDay(day).toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function weekdayName(day: string): string {
  return parseDay(day).toLocaleDateString('pl-PL', { weekday: 'long' });
}

export function localDayString(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export const STATUS_LABEL: Record<EntryStatus, string> = {
  workout: 'Trening',
  rest: 'Odpoczynek',
  sick: 'Chory',
};

export function pluralDays(n: number): string {
  return n === 1 ? '1 dzień' : `${n} dni`;
}

/** Human-readable reason for any error, with the HTTP status if known. */
export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    return e.status ? `${e.status}: ${e.message}` : e.message;
  }
  return e instanceof Error ? e.message : String(e);
}

/** First chars of a file URI: shows file:// vs content:// without noise. */
export function shortUri(uri: string, max = 70): string {
  return uri.length > max ? `${uri.slice(0, max)}…` : uri;
}

const MONTHS = [
  'styczeń',
  'luty',
  'marzec',
  'kwiecień',
  'maj',
  'czerwiec',
  'lipiec',
  'sierpień',
  'wrzesień',
  'październik',
  'listopad',
  'grudzień',
];

/** 'YYYY-MM' of a date (local time). */
export function monthString(now = new Date()): string {
  return localDayString(now).slice(0, 7);
}

/** 'YYYY-MM' moved by whole months (handles Dec -> Jan). */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  return `${ny}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

/** "styczeń 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * Weeks of the month, Monday first: each row has 7 cells holding the
 * day number or null for the days that belong to the neighbour months.
 */
export function monthGrid(month: string): (number | null)[][] {
  const [y, m] = month.split('-').map(Number);
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Mon = 0
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth(month) }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export const WEEKDAYS_SHORT = ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'];

/** 'YYYY-MM' + day number -> 'YYYY-MM-DD' */
export function dayOf(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, '0')}`;
}

/** '2026-01-05' -> '5.01' (short label for chart axes) */
export function shortDate(day: string): string {
  const [, m, d] = day.split('-');
  return `${Number(d)}.${m}`;
}
