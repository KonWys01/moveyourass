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
