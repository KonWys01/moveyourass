import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import History from '../app/(tabs)/history';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('expo-image-picker', () => ({}));

const mockApi = { get: jest.fn(), post: jest.fn(), del: jest.fn() };
jest.mock('@/auth/session', () => ({
  useSession: () => ({ api: mockApi, user: { id: 'me' } }),
}));

const user = {
  id: 'me',
  first_name: 'Ala',
  last_name: 'Kot',
  avatar_url: null,
  is_public: true,
};

function entry(id: string, extra = {}) {
  return {
    id,
    date: '2026-01-05',
    created_at: '2026-01-05T10:00:00+00:00',
    status: 'workout',
    workouts: [
      {
        id: `w${id}`,
        category: { id: 1, name: 'Bieganie' },
        description: null,
        photos: [],
      },
    ],
    user,
    like_count: 3,
    comment_count: 2,
    liked_by_me: false,
    ...extra,
  };
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
  mockApi.get.mockReset();
  mockPush.mockReset();
});

test('each workout in the history shows its likes and comments', async () => {
  mockApi.get.mockResolvedValue([entry('1')]);
  await renderHistory();

  expect(await screen.findByText('Bieganie')).toBeTruthy();
  expect(screen.getByText('♡ 3')).toBeTruthy();
  expect(screen.getByText('💬 2')).toBeTruthy();
});

test('tapping a workout in the history opens the entry', async () => {
  mockApi.get.mockResolvedValue([entry('abc')]);
  await renderHistory();

  await fireEvent.press(await screen.findByText('Bieganie'));

  expect(mockPush).toHaveBeenCalledWith('/entry/abc');
});

test('the comments button opens the entry too', async () => {
  mockApi.get.mockResolvedValue([entry('abc')]);
  await renderHistory();

  await fireEvent.press(await screen.findByLabelText('Komentarze'));

  expect(mockPush).toHaveBeenCalledWith('/entry/abc');
});

test('an older backend without counts shows zeros, not undefined', async () => {
  const old = entry('1');
  delete (old as Record<string, unknown>).like_count;
  delete (old as Record<string, unknown>).comment_count;
  mockApi.get.mockResolvedValue([old]);
  await renderHistory();

  expect(await screen.findByText('♡ 0')).toBeTruthy();
  expect(screen.getByText('💬 0')).toBeTruthy();
});

test('rest and sick days stay as plain text without counters', async () => {
  mockApi.get.mockResolvedValue([entry('2', { status: 'rest', workouts: [] })]);
  await renderHistory();

  expect(await screen.findByText('Odpoczynek')).toBeTruthy();
  expect(screen.queryByText(/♡/)).toBeNull();
});
