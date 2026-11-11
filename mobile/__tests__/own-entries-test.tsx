import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';

import History from '../app/(tabs)/history';
import { EntryCard } from '@/components/EntryCard';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('expo-image-picker', () => ({}));

const mockApi = { get: jest.fn(), post: jest.fn(), del: jest.fn() };
jest.mock('@/auth/session', () => ({
  useSession: () => ({ api: mockApi, user: { id: 'me' } }),
}));

const ala = { id: 'me', first_name: 'Ala', last_name: 'Kot', avatar_url: null, is_public: true };
const bob = { ...ala, id: 'bob', first_name: 'Bob' };

function entry(id: string, user = ala, extra = {}) {
  return {
    id,
    date: '2026-01-05',
    created_at: '2026-01-05T10:00:00+00:00',
    status: 'workout',
    workouts: [
      { id: `w${id}`, category: { id: 1, name: 'Bieganie' }, description: null, photos: [] },
    ],
    user,
    like_count: 0,
    comment_count: 0,
    liked_by_me: false,
    ...extra,
  };
}

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockApi.get.mockReset();
  mockApi.del.mockReset();
  mockPush.mockReset();
});

test('own workout has an Edit button that opens the edit screen', async () => {
  await wrap(<EntryCard entry={entry('1') as never} />);
  await fireEvent.press(screen.getByLabelText('Edytuj trening'));
  expect(mockPush).toHaveBeenCalledWith('/edit-workout/w1?entry=1');
});

test("someone else's workout has no Edit button", async () => {
  await wrap(<EntryCard entry={entry('2', bob) as never} />);
  expect(screen.queryByLabelText('Edytuj trening')).toBeNull();
});

test('a rest day in the history can be deleted after confirming', async () => {
  mockApi.get.mockResolvedValue([entry('3', ala, { status: 'rest', workouts: [] })]);
  mockApi.del.mockResolvedValue(undefined);
  await wrap(<History />);

  await fireEvent.press(await screen.findByLabelText('Usuń dzień'));
  expect(mockApi.del).not.toHaveBeenCalled();
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
  buttons.find((b: { text: string }) => b.text === 'Usuń').onPress();
  await waitFor(() => expect(mockApi.del).toHaveBeenCalledWith('/entries/3'));
});
