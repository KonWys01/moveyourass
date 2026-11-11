import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import EntryScreen from '../app/entry/[id]';
import Search from '../app/(tabs)/search';
import UserScreen from '../app/user/[id]';
import { useFeed } from '@/api/social';
import type { SocialEntry } from '@/api/types';
import { EntryCard } from '@/components/EntryCard';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ id: 'target' }),
  Stack: { Screen: () => null },
}));
jest.mock('expo-image-picker', () => ({}));

const mockApi = { get: jest.fn(), post: jest.fn(), del: jest.fn() };
jest.mock('@/auth/session', () => ({
  useSession: () => ({ api: mockApi, user: { id: 'me' } }),
}));

function wrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const brief = (id: string, extra = {}) => ({
  id,
  first_name: 'Ala',
  last_name: 'Kot',
  avatar_url: null,
  is_public: true,
  ...extra,
});

function entry(id: string, extra: Partial<SocialEntry> = {}): SocialEntry {
  return {
    id,
    date: '2026-01-05',
    created_at: `2026-01-05T10:00:${id.padStart(2, '0')}+00:00`,
    status: 'workout',
    workouts: [
      {
        id: `w${id}`,
        category: { id: 1, name: 'Bieganie' },
        description: null,
        photos: [],
      },
    ],
    user: brief('u1'),
    like_count: 2,
    liked_by_me: false,
    comment_count: 1,
    ...extra,
  };
}

beforeEach(() => {
  Object.values(mockApi).forEach((f) => f.mockReset());
  mockPush.mockReset();
});

test('feed cursor is the last item created_at, stops on a short page', async () => {
  const page1 = Array.from({ length: 20 }, (_, i) => ({
    ...entry(String(i + 1)),
    stats: { streak: 1, week_progress: 1, week_threshold: 1 },
  }));
  mockApi.get.mockResolvedValueOnce(page1).mockResolvedValueOnce([]);
  const { result } = await renderHook(() => useFeed(), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.data).toBeTruthy());
  expect(mockApi.get).toHaveBeenCalledWith('/feed', {
    limit: 20,
    before: undefined,
  });

  await act(async () => {
    await result.current.fetchNextPage();
  });

  expect(mockApi.get).toHaveBeenLastCalledWith('/feed', {
    limit: 20,
    before: page1[19].created_at,
  });
  await waitFor(() => expect(result.current.hasNextPage).toBe(false));
});

test('like button likes, and unlikes when already liked', async () => {
  mockApi.post.mockResolvedValue(undefined);
  mockApi.del.mockResolvedValue(undefined);
  const { rerender } = await render(<EntryCard entry={entry('1')} />, {
    wrapper: wrapper(),
  });

  await fireEvent.press(screen.getByLabelText('Polub'));
  await waitFor(() =>
    expect(mockApi.post).toHaveBeenCalledWith('/entries/1/like'),
  );

  await rerender(<EntryCard entry={entry('1', { liked_by_me: true })} />);
  await fireEvent.press(screen.getByLabelText('Cofnij lajk'));
  await waitFor(() =>
    expect(mockApi.del).toHaveBeenCalledWith('/entries/1/like'),
  );
});

test('private profile hides entries and never requests them', async () => {
  mockApi.get.mockImplementation(async (path: string) => {
    if (path === '/users/target') {
      return {
        ...brief('target', { is_public: false }),
        follow_status: 'none',
        can_view: false,
        stats: null,
      };
    }
    throw new Error(`unexpected ${path}`);
  });
  await render(<UserScreen />, { wrapper: wrapper() });

  expect(await screen.findByText(/Profil prywatny/)).toBeTruthy();
  expect(mockApi.get).toHaveBeenCalledTimes(1);

  mockApi.post.mockResolvedValue({ status: 'pending' });
  await fireEvent.press(screen.getByText('Obserwuj'));
  await waitFor(() =>
    expect(mockApi.post).toHaveBeenCalledWith('/users/target/follow'),
  );
});

test('unfollow button when already following', async () => {
  mockApi.get.mockImplementation(async (path: string) =>
    path === '/users/target'
      ? {
          ...brief('target'),
          follow_status: 'accepted',
          can_view: true,
          stats: { streak: 2, week_progress: 1, week_threshold: 1 },
        }
      : [],
  );
  mockApi.del.mockResolvedValue(undefined);
  await render(<UserScreen />, { wrapper: wrapper() });

  await fireEvent.press(await screen.findByText('Obserwujesz'));

  await waitFor(() =>
    expect(mockApi.del).toHaveBeenCalledWith('/users/target/follow'),
  );
});

describe('search', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('debounces and ignores single-character queries', async () => {
    mockApi.get.mockImplementation(async (path: string) =>
      path === '/follow-requests'
        ? []
        : [{ ...brief('x', { is_public: false }), follow_status: 'none' }],
    );
    await render(<Search />, { wrapper: wrapper() });
    const input = screen.getByPlaceholderText(/Szukaj osób/);

    await fireEvent.changeText(input, 'a');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(mockApi.get).not.toHaveBeenCalledWith(
      '/users/search',
      expect.anything(),
    );

    await fireEvent.changeText(input, 'al');
    await fireEvent.changeText(input, 'ala');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() =>
      expect(mockApi.get).toHaveBeenCalledWith('/users/search', {
        q: 'ala',
      }),
    );
    const calls = mockApi.get.mock.calls.filter(
      (c) => c[0] === '/users/search',
    );
    expect(calls).toHaveLength(1);
    expect(await screen.findByText(/🔒/)).toBeTruthy();
  });
});

test('entry owner sees and can delete others comments (long press)', async () => {
  const alertSpy = jest
    .spyOn(require('react-native').Alert, 'alert')
    .mockImplementation(() => {});
  mockApi.get.mockImplementation(async (path: string) => {
    if (path === '/entries/target')
      return entry('1', { user: brief('me') });
    if (path === '/entries/target/comments')
      return [
        {
          id: 'c1',
          user: brief('other'),
          text: 'super!',
          created_at: '2026-01-05T11:00:00+00:00',
        },
      ];
    throw new Error(path);
  });
  await render(<EntryScreen />, { wrapper: wrapper() });

  await fireEvent(await screen.findByText(/super!/), 'longPress');

  expect(alertSpy).toHaveBeenCalledWith(
    'Usunąć komentarz?',
    undefined,
    expect.any(Array),
  );
  alertSpy.mockRestore();
});

test('stranger cannot delete comments they do not own', async () => {
  const alertSpy = jest
    .spyOn(require('react-native').Alert, 'alert')
    .mockImplementation(() => {});
  mockApi.get.mockImplementation(async (path: string) => {
    if (path === '/entries/target')
      return entry('1', { user: brief('someone') });
    return [
      {
        id: 'c1',
        user: brief('other'),
        text: 'cudze',
        created_at: '2026-01-05T11:00:00+00:00',
      },
    ];
  });
  await render(<EntryScreen />, { wrapper: wrapper() });

  await fireEvent(await screen.findByText(/cudze/), 'longPress');

  expect(alertSpy).not.toHaveBeenCalled();
  alertSpy.mockRestore();
});

test('owner sees who liked the entry', async () => {
  mockApi.get.mockImplementation(async (path: string) => {
    if (path === '/entries/target')
      return entry('1', { user: brief('me'), like_count: 2 });
    if (path === '/entries/target/likes')
      return [
        brief('a', { first_name: 'Ola', last_name: 'Nowak' }),
        brief('b', { first_name: 'Bartek', last_name: 'Zając' }),
      ];
    return [];
  });
  await render(<EntryScreen />, { wrapper: wrapper() });

  expect(
    await screen.findByText('Polubili: Ola N., Bartek Z.'),
  ).toBeTruthy();
});

test('likes are not fetched for a stranger entry or with no likes', async () => {
  mockApi.get.mockImplementation(async (path: string) => {
    if (path === '/entries/target')
      return entry('1', { user: brief('someone'), like_count: 2 });
    return [];
  });
  await render(<EntryScreen />, { wrapper: wrapper() });
  await screen.findByText('Bieganie');

  expect(
    mockApi.get.mock.calls.some((c) => c[0] === '/entries/target/likes'),
  ).toBe(false);
});
