import {
  formatDay,
  localDayString,
  parseDay,
  pluralDays,
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
