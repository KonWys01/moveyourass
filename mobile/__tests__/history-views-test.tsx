import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';

import History from '../app/(tabs)/history';
import { dayOf, monthString, shiftMonth } from '@/format';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('expo-image-picker', () => ({}));

const mockApi = { get: jest.fn(), post: jest.fn(), del: jest.fn() };
jest.mock('@/auth/session', () => ({
  useSession: () => ({ api: mockApi, user: { id: 'me' } }),
}));

const month = monthString();

const stats = {
  total_workouts: 42,
  active_days: 30,
  total_photos: 17,
  this_month: { workouts: 6, active_days: 5 },
  current_streak: 4,
  longest_streak: 9,
  best_week_days: 6,
  weeks: Array.from({ length: 12 }, (_, i) => ({
    week_start: `2026-01-${String(i + 1).padStart(2, '0')}`,
    days: i % 4, // 0,1,2,3,...
  })),
  categories: [
    { name: 'Bieganie', count: 20 },
    { name: 'Rower', count: 10 },
  ],
  badges: [
    {
      id: 'first',
      icon: '🥇',
      title: 'Pierwszy krok',
      description: 'Pierwszy trening',
      earned: true,
      progress: 1,
      target: 1,
    },
    {
      id: 'ten',
      icon: '💪',
      title: 'Dziesiątka',
      description: '10 treningów',
      earned: false,
      progress: 3,
      target: 10,
    },
  ],
};

function serve(
  days: unknown[] = [],
  extra: Record<string, unknown> = {},
) {
  mockApi.get.mockImplementation(async (path: string, params?: any) => {
    if (path === '/entries/me') return [];
    if (path === '/me/calendar')
      return { month: params?.month, days: params?.month === month ? days : [] };
    if (path === '/me/stats') return stats;
    if (path in extra) return extra[path];
    throw new Error(path);
  });
}

function renderHistory() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <History />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockApi.get.mockReset();
  mockApi.del.mockReset();
  mockPush.mockReset();
});

test('history opens on the list and switches views', async () => {
  serve();
  await renderHistory();

  expect(await screen.findByText('Jeszcze nic tu nie ma.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Kalendarz'));
  expect(await screen.findByLabelText('Poprzedni miesiąc')).toBeTruthy();
  await fireEvent.press(screen.getByText('Statystyki'));
  expect(await screen.findByText('Osiągnięcia')).toBeTruthy();
  await fireEvent.press(screen.getByText('Lista'));
  expect(await screen.findByText('Jeszcze nic tu nie ma.')).toBeTruthy();
});

describe('calendar', () => {
  const days = [
    { date: dayOf(month, 1), status: 'workout', entry_id: 'e1', workouts: 1, photos: 0 },
    { date: dayOf(month, 2), status: 'rest', entry_id: 'e2', workouts: 0, photos: 0 },
    { date: dayOf(month, 3), status: 'sick', entry_id: 'e3', workouts: 0, photos: 0 },
  ];

  async function openCalendar() {
    serve(days);
    await renderHistory();
    await fireEvent.press(screen.getByText('Kalendarz'));
    await screen.findByLabelText('1: Trening');
  }

  test('colours days by status and counts workout days', async () => {
    await openCalendar();

    const flat = (label: string) =>
      screen.getByLabelText(label).props.style.flat?.() ??
      [screen.getByLabelText(label).props.style].flat(2);
    const bg = (label: string) =>
      Object.assign({}, ...flat(label).filter(Boolean)).backgroundColor;
    expect(bg('1: Trening')).toBe('#16a34a'); // primary
    expect(bg('2: Odpoczynek')).toBe('#6b7280'); // muted
    expect(bg('3: Chory')).toBe('#d97706'); // warn
    expect(
      screen.getByText('W tym miesiącu: 1 dzień z treningiem'),
    ).toBeTruthy();
  });

  test('tapping a workout day opens the entry', async () => {
    await openCalendar();

    await fireEvent.press(screen.getByLabelText('1: Trening'));

    expect(mockPush).toHaveBeenCalledWith('/entry/e1');
  });

  test('tapping a rest day offers to delete it', async () => {
    await openCalendar();
    mockApi.del.mockResolvedValue(undefined);

    await fireEvent.press(screen.getByLabelText('2: Odpoczynek'));

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    await buttons.find((b: any) => b.text === 'Usuń').onPress();
    expect(mockApi.del).toHaveBeenCalledWith('/entries/e2');
    expect(mockPush).not.toHaveBeenCalled();
  });

  test('can go back a month but never into the future', async () => {
    await openCalendar();
    const next = screen.getByLabelText('Następny miesiąc');
    expect(next.props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByLabelText('Poprzedni miesiąc'));

    await screen.findByText(/20\d\d$/); // month label rendered
    expect(
      mockApi.get.mock.calls.some(
        (c) =>
          c[0] === '/me/calendar' &&
          c[1]?.month === shiftMonth(month, -1),
      ),
    ).toBe(true);
    expect(
      screen.getByLabelText('Następny miesiąc').props.accessibilityState
        .disabled,
    ).toBe(false);
  });
});

describe('stats', () => {
  async function openStats() {
    serve();
    await renderHistory();
    await fireEvent.press(screen.getByText('Statystyki'));
    await screen.findByText('Osiągnięcia');
  }

  test('shows totals, streak records and the best week', async () => {
    await openStats();

    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
    expect(screen.getByText('17')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy(); // this month
    expect(screen.getByText('🔥 4')).toBeTruthy();
    expect(screen.getByText('🏆 9')).toBeTruthy();
    expect(screen.getByText('Najlepszy tydzień: 6 dni z treningiem')).toBeTruthy();
  });

  test('draws one bar per week, proportional to the best week', async () => {
    await openStats();

    const bars = screen.getAllByTestId('week-bar');
    expect(bars).toHaveLength(12);
    const h = (i: number) =>
      [bars[i].props.style].flat(2).reduce((a: any, b: any) => ({ ...a, ...b }), {}).height;
    expect(h(3)).toBe(90); // 3 days = the maximum
    expect(h(2)).toBeCloseTo(60); // 2 of 3
    expect(h(0)).toBe(2); // empty week stays a thin stub
  });

  test('lists categories with bars relative to the biggest', async () => {
    await openStats();

    expect(screen.getByText('Bieganie')).toBeTruthy();
    const bars = screen.getAllByTestId('category-bar');
    const w = (i: number) =>
      [bars[i].props.style].flat(2).reduce((a: any, b: any) => ({ ...a, ...b }), {}).width;
    expect(w(0)).toBe('100%');
    expect(w(1)).toBe('50%');
  });

  test('badges: earned ones are plain, the rest show progress', async () => {
    await openStats();

    expect(screen.getByLabelText('Pierwszy krok: zdobyta')).toBeTruthy();
    expect(screen.getByLabelText('Dziesiątka: 3/10')).toBeTruthy();
    expect(screen.getByText('3/10')).toBeTruthy();
    expect(screen.queryByText('1/1')).toBeNull();
  });
});
