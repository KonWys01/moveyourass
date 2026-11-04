import { ApiError } from '@/api/client';
import {
  describeError,
  formatDay,
  localDayString,
  parseDay,
  pluralDays,
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
