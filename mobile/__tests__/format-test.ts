import { ApiError } from '@/api/client';
import {
  dayOf,
  daysInMonth,
  describeError,
  formatDay,
  localDayString,
  monthGrid,
  monthLabel,
  monthString,
  parseDay,
  pluralDays,
  shiftMonth,
  shortDate,
  shortUri,
  weekdayName,
} from '@/format';

test('parseDay does not shift across timezones', () => {
  const d = parseDay('2026-01-05');
  expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([
    2026, 0, 5,
  ]);
});

test('localDayString zero-pads', () => {
  expect(localDayString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  expect(localDayString(new Date(2026, 10, 25))).toBe('2026-11-25');
});

test('weekday and full date are produced', () => {
  expect(weekdayName('2026-01-05').length).toBeGreaterThan(3);
  expect(formatDay('2026-01-05')).toMatch(/5/);
});

test('pluralDays', () => {
  expect(pluralDays(1)).toBe('1 dzień');
  expect(pluralDays(5)).toBe('5 dni');
});

test('describeError shows the HTTP status when there is one', () => {
  expect(describeError(new ApiError(413, 'Image too large'))).toBe(
    '413: Image too large',
  );
  expect(describeError(new ApiError(0, 'Brak połączenia (x)'))).toBe(
    'Brak połączenia (x)',
  );
  expect(describeError(new Error('boom'))).toBe('boom');
  expect(describeError('plain')).toBe('plain');
});

test('shortUri keeps the scheme visible and truncates long paths', () => {
  expect(shortUri('file:///a.jpg')).toBe('file:///a.jpg');
  const long = 'content://media/' + 'x'.repeat(100);
  expect(shortUri(long).startsWith('content://media/')).toBe(true);
  expect(shortUri(long).length).toBeLessThan(80);
});

test('monthGrid starts weeks on Monday', () => {
  // 2026-02-01 is a Sunday: six empty cells before it
  const feb = monthGrid('2026-02');
  expect(feb[0]).toEqual([null, null, null, null, null, null, 1]);
  expect(feb.flat().filter(Boolean)).toHaveLength(28);
  expect(feb).toHaveLength(5);
  // 2026-06-01 is a Monday: no leading blanks
  expect(monthGrid('2026-06')[0][0]).toBe(1);
});

test('monthGrid pads the last week and knows leap years', () => {
  const g = monthGrid('2024-02'); // 29 days, starts on Thursday
  expect(g.flat().filter(Boolean)).toHaveLength(29);
  expect(g.every((w) => w.length === 7)).toBe(true);
  expect(g[0].indexOf(1)).toBe(3);
  expect(daysInMonth('2024-02')).toBe(29);
  expect(daysInMonth('2026-02')).toBe(28);
  expect(daysInMonth('2026-12')).toBe(31);
});

test('shiftMonth crosses year boundaries', () => {
  expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  expect(shiftMonth('2025-12', 1)).toBe('2026-01');
  expect(shiftMonth('2026-03', -14)).toBe('2025-01');
  expect(shiftMonth('2026-03', 0)).toBe('2026-03');
});

test('month helpers format for the UI', () => {
  expect(monthLabel('2026-01')).toBe('styczeń 2026');
  expect(monthLabel('2026-12')).toBe('grudzień 2026');
  expect(monthString(new Date(2026, 0, 31))).toBe('2026-01');
  expect(dayOf('2026-01', 5)).toBe('2026-01-05');
  expect(shortDate('2026-01-05')).toBe('5.01');
});
