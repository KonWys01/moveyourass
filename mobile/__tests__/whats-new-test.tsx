import { fireEvent, render, screen } from '@testing-library/react-native';

import { CHANGELOG, unseenEntries } from '@/changelog';
import { WhatsNewModal } from '@/components/WhatsNew';

jest.mock('expo-application', () => ({}));
jest.mock('expo-secure-store', () => ({}));

const log = [
  { id: 3, title: 'c', items: ['c1'] },
  { id: 2, title: 'b', items: ['b1'] },
  { id: 1, title: 'a', items: ['a1'] },
];

test('changelog ids are unique and every entry says something', () => {
  expect(new Set(CHANGELOG.map((e) => e.id)).size).toBe(CHANGELOG.length);
  for (const e of CHANGELOG) expect(e.items.length).toBeGreaterThan(0);
});

test('unseen: fresh install shows nothing, update shows the newest', () => {
  expect(unseenEntries(null, false, log)).toEqual([]);
  expect(unseenEntries(null, true, log).map((e) => e.id)).toEqual([3]);
});

test('unseen: everything newer than the last seen, newest first', () => {
  expect(unseenEntries(1, false, log).map((e) => e.id)).toEqual([3, 2]);
  expect(unseenEntries(3, true, log)).toEqual([]);
});

function layout(height: number) {
  return { nativeEvent: { layout: { x: 0, y: 0, width: 300, height } } };
}

test('long notes: close only after scrolling to the end', async () => {
  const onClose = jest.fn();
  await render(<WhatsNewModal entries={log} onClose={onClose} />);
  const scroll = screen.getByTestId('whats-new-scroll');
  await fireEvent(scroll, 'layout', layout(300));
  await fireEvent(scroll, 'contentSizeChange', 300, 900);

  await fireEvent.press(screen.getByText('Zamknij'));
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByText('Przewiń do końca, żeby zamknąć')).toBeTruthy();

  await fireEvent.scroll(scroll, {
    nativeEvent: {
      contentOffset: { x: 0, y: 600 },
      layoutMeasurement: { width: 300, height: 300 },
      contentSize: { width: 300, height: 900 },
    },
  });
  await fireEvent.press(screen.getByText('Zamknij'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('short notes that fit can be closed right away', async () => {
  const onClose = jest.fn();
  await render(<WhatsNewModal entries={[log[0]]} onClose={onClose} />);
  const scroll = screen.getByTestId('whats-new-scroll');
  await fireEvent(scroll, 'layout', layout(120));
  await fireEvent(scroll, 'contentSizeChange', 300, 120);

  await fireEvent.press(screen.getByText('Zamknij'));
  expect(onClose).toHaveBeenCalledTimes(1);
});
