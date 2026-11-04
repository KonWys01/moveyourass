import fs from 'fs';
import path from 'path';

import { TABS } from '@/tabs';

const dir = path.join(__dirname, '..', 'app', '(tabs)');
const screens = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.tsx') && !f.startsWith('_'))
  .map((f) => f.replace(/\.tsx$/, ''));

test('every tab screen file has a title and an icon (no placeholder boxes)', () => {
  for (const name of screens) {
    const tab = TABS.find((t) => t.name === name);
    expect(tab).toBeDefined();
    expect(tab!.title.length).toBeGreaterThan(0);
    expect(tab!.icon.length).toBeGreaterThan(0);
  }
});

test('no tab points at a screen that does not exist', () => {
  for (const tab of TABS) expect(screens).toContain(tab.name);
});

test('tab names and icons are unique', () => {
  expect(new Set(TABS.map((t) => t.name)).size).toBe(TABS.length);
  expect(new Set(TABS.map((t) => t.icon)).size).toBe(TABS.length);
});
