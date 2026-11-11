import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Today from '../app/(tabs)/index';
import { ApiError } from '@/api/client';
import { localDayString } from '@/format';
import { Alert } from 'react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-image-picker', () => ({}));

const mockPick = jest.fn();
jest.mock('@/api/photos', () => ({
  ...jest.requireActual('@/api/photos'),
  pickPhotos: (...args: unknown[]) => mockPick(...args),
}));

const mockApi = {
  get: jest.fn(),
  post: jest.fn(),
  upload: jest.fn(),
  del: jest.fn(),
};
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

// every screen query goes through mockApi.get; route by path
function serve(today: unknown) {
  mockApi.get.mockImplementation(async (path: string) =>
    path === '/app/version'
      ? { update_available: false, update_required: false }
      : today,
  );
}

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.post.mockReset();
  mockPush.mockReset();
});

test('shows streak and week progress', async () => {
  serve(base);
  await renderToday();

  expect(await screen.findByText('Seria: 3 tyg.')).toBeTruthy();
  expect(screen.getByText('Ten tydzień: 1 z 2')).toBeTruthy();
});

test('shows rest hint after days without training', async () => {
  serve({
    ...base,
    days_since_workout: 4,
    show_rest_hint: true,
  });
  await renderToday();

  expect(await screen.findByText(/Od 4 dni bez treningu/)).toBeTruthy();
});

test('marks rest through the API', async () => {
  serve(base);
  mockApi.post.mockResolvedValue({});
  await renderToday();

  await fireEvent.press(await screen.findByText('Odpoczynek'));

  expect(mockApi.post).toHaveBeenCalledWith('/entries/rest');
  // let the mutation finish and the refetch after it settle
  await waitFor(() =>
    expect(
      mockApi.get.mock.calls.filter((c) => c[0] === '/entries/today'),
    ).toHaveLength(2),
  );
});

test('rest and sick buttons are hidden once trained today', async () => {
  serve({
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
  serve({ ...base, date: '2000-01-03' });
  await renderToday();

  expect(await screen.findByText(/Zaliczone za:/)).toBeTruthy();
});

test('add workout opens the form', async () => {
  serve(base);
  await renderToday();

  await fireEvent.press(await screen.findByText('Dodaj trening'));

  expect(mockPush).toHaveBeenCalledWith('/add-workout');
});

test('load error offers retry', async () => {
  mockApi.get.mockImplementation(async (path: string) => {
    if (path === '/app/version') return { update_available: false };
    throw new Error('x');
  });
  await renderToday();

  expect(
    await screen.findByText('Nie udało się wczytać danych.'),
  ).toBeTruthy();
  serve(base);
  await fireEvent.press(screen.getByText('Spróbuj ponownie'));
  expect(await screen.findByText('Seria: 3 tyg.')).toBeTruthy();
});

test('a failed photo upload says why and for which file', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  serve({
    ...base,
    entry: {
      id: 'e1',
      date: base.date,
      created_at: '2026-01-05T10:00:00+00:00',
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
  mockPick.mockResolvedValue(['file:///data/cache/ImagePicker/a.jpeg']);
  mockApi.upload.mockRejectedValue(
    new ApiError(0, 'Brak połączenia z serwerem (Network request failed)'),
  );
  await renderToday();

  await fireEvent.press(await screen.findByText('Galeria'));

  await waitFor(() => expect(alert).toHaveBeenCalled());
  const [title, message] = alert.mock.calls[0] as [string, string];
  expect(title).toBe('Nie wysłano zdjęć: 1 z 1');
  expect(message).toContain('Network request failed');
  expect(message).toContain('file:///data/cache/ImagePicker/a.jpeg');
  expect(warn).toHaveBeenCalled(); // also goes to logcat for adb
  alert.mockRestore();
  warn.mockRestore();
});

const withWorkout = {
  ...base,
  entry: {
    id: 'e1',
    date: base.date,
    created_at: '2026-01-05T10:00:00+00:00',
    status: 'workout',
    workouts: [
      {
        id: 'w1',
        category: { id: 1, name: 'Bieganie' },
        description: null,
        photos: [{ id: 'p1', url: 'https://img/1.jpg' }],
      },
    ],
  },
};

function pressConfirm() {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
  buttons.find((b: { text: string }) => b.text === 'Usuń').onPress();
}

test('a photo has a visible ✕ that deletes it after confirming', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockApi.del.mockReset().mockResolvedValue(undefined);
  serve(withWorkout);
  await renderToday();

  await fireEvent.press(await screen.findByLabelText('Usuń zdjęcie'));
  expect(mockApi.del).not.toHaveBeenCalled();
  pressConfirm();
  await waitFor(() => expect(mockApi.del).toHaveBeenCalledWith('/photos/p1'));
});

test('Edit opens the edit screen of that workout', async () => {
  serve(withWorkout);
  await renderToday();

  await fireEvent.press(await screen.findByLabelText('Edytuj trening'));
  expect(mockPush).toHaveBeenCalledWith('/edit-workout/w1?entry=e1');
});

test('a rest day marked by mistake can be deleted', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockApi.del.mockReset().mockResolvedValue(undefined);
  serve({
    ...base,
    entry: { ...withWorkout.entry, status: 'rest', workouts: [] },
  });
  await renderToday();

  await fireEvent.press(await screen.findByLabelText('Usuń wpis dnia'));
  pressConfirm();
  await waitFor(() => expect(mockApi.del).toHaveBeenCalledWith('/entries/e1'));
});

const trained = {
  id: 'e1',
  date: localDayString(),
  created_at: '2026-01-05T10:00:00+00:00',
  status: 'workout',
  workouts: [
    {
      id: 'w1',
      category: { id: 1, name: 'Bieganie' },
      description: null,
      photos: [],
    },
  ],
};

test('shows likes and comments of today\'s entry and opens it', async () => {
  serve({ ...base, entry: trained, like_count: 3, comment_count: 2 });
  await renderToday();

  expect(await screen.findByText('♥ 3')).toBeTruthy();
  expect(screen.getByText('💬 2')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Reakcje na dzisiejszy wpis'));

  expect(mockPush).toHaveBeenCalledWith('/entry/e1');
});

test('reactions row shows zeros on an older backend and is hidden without workouts', async () => {
  serve({ ...base, entry: trained });
  const first = await renderToday();
  expect(await screen.findByText('♥ 0')).toBeTruthy();
  first.unmount();

  serve({ ...base, entry: { ...trained, status: 'rest', workouts: [] } });
  await renderToday();
  await screen.findByText(/Dziś:/);
  expect(screen.queryByLabelText('Reakcje na dzisiejszy wpis')).toBeNull();
});
