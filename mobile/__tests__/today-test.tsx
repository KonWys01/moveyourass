import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Today from '../app/(tabs)/index';
import { localDayString } from '@/format';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-image-picker', () => ({}));

const mockApi = { get: jest.fn(), post: jest.fn() };
jest.mock('@/auth/session', () => ({
  useSession: () => ({ api: mockApi }),
}));

function renderToday() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <Today />
    </QueryClientProvider>,
  );
}

const base = {
  date: localDayString(),
  entry: null,
  streak: 3,
  week_progress: 1,
  week_threshold: 2,
  days_since_workout: null,
  show_rest_hint: false,
};

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.post.mockReset();
  mockPush.mockReset();
});

test('shows streak and week progress', async () => {
  mockApi.get.mockResolvedValue(base);
  await renderToday();

  expect(await screen.findByText('Seria: 3 tyg.')).toBeTruthy();
  expect(screen.getByText('Ten tydzień: 1 z 2')).toBeTruthy();
});

test('shows rest hint after days without training', async () => {
  mockApi.get.mockResolvedValue({
    ...base,
    days_since_workout: 4,
    show_rest_hint: true,
  });
  await renderToday();

  expect(await screen.findByText(/Od 4 dni bez treningu/)).toBeTruthy();
});

test('marks rest through the API', async () => {
  mockApi.get.mockResolvedValue(base);
  mockApi.post.mockResolvedValue({});
  await renderToday();

  await fireEvent.press(await screen.findByText('Odpoczynek'));

  expect(mockApi.post).toHaveBeenCalledWith('/entries/rest');
  // let the mutation finish and the refetch after it settle
  await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(2));
});

test('rest and sick buttons are hidden once trained today', async () => {
  mockApi.get.mockResolvedValue({
    ...base,
    entry: {
      id: 'e1',
      date: base.date,
      status: 'workout',
      workouts: [
        {
          id: 'w1',
          category: { id: 1, name: 'Bieganie' },
          description: null,
          photos: [],
        },
      ],
    },
  });
  await renderToday();

  expect(await screen.findByText('Bieganie')).toBeTruthy();
  expect(screen.queryByText('Odpoczynek')).toBeNull();
});

test('says when the day is counted for yesterday (midnight buffer)', async () => {
  mockApi.get.mockResolvedValue({ ...base, date: '2000-01-03' });
  await renderToday();

  expect(await screen.findByText(/Zaliczone za:/)).toBeTruthy();
});

test('add workout opens the form', async () => {
  mockApi.get.mockResolvedValue(base);
  await renderToday();

  await fireEvent.press(await screen.findByText('Dodaj trening'));

  expect(mockPush).toHaveBeenCalledWith('/add-workout');
});

test('load error offers retry', async () => {
  mockApi.get.mockRejectedValueOnce(new Error('x'));
  await renderToday();

  expect(
    await screen.findByText('Nie udało się wczytać danych.'),
  ).toBeTruthy();
  mockApi.get.mockResolvedValue(base);
  await fireEvent.press(screen.getByText('Spróbuj ponownie'));
  expect(await screen.findByText('Seria: 3 tyg.')).toBeTruthy();
});
