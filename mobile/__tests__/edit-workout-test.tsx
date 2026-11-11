import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';

import EditWorkout from '../app/edit-workout/[id]';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'w1', entry: 'e1' }),
}));
jest.mock('expo-image-picker', () => ({}));
const mockPick = jest.fn();
jest.mock('@/api/photos', () => ({
  ...jest.requireActual('@/api/photos'),
  pickPhotos: (...a: unknown[]) => mockPick(...a),
}));

const mockApi = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  del: jest.fn(),
  upload: jest.fn(),
};
jest.mock('@/auth/session', () => ({
  useSession: () => ({ api: mockApi, user: { id: 'me' } }),
}));

const entry = {
  id: 'e1',
  date: '2026-01-05',
  created_at: '2026-01-05T10:00:00+00:00',
  status: 'workout',
  user: { id: 'me', first_name: 'Ala', last_name: 'Kot', avatar_url: null },
  like_count: 0,
  comment_count: 0,
  liked_by_me: false,
  workouts: [
    {
      id: 'w1',
      category: { id: 1, name: 'Bieganie' },
      description: '5 km',
      photos: [{ id: 'p1', url: 'https://img/1.jpg' }],
    },
  ],
};

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <EditWorkout />
    </QueryClientProvider>,
  );
}

// presses the destructive/confirm button of the last Alert
function confirmAlert() {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)[2] as {
    text: string;
    onPress?: () => void;
  }[];
  buttons.find((b) => b.text === 'Usuń')!.onPress!();
}

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  for (const m of Object.values(mockApi)) m.mockReset();
  mockBack.mockReset();
  mockPick.mockReset();
  mockApi.get.mockImplementation(async (path: string) =>
    path === '/categories'
      ? [
          { id: 1, name: 'Bieganie' },
          { id: 2, name: 'Rower' },
        ]
      : entry,
  );
});

test('is prefilled with the workout', async () => {
  await renderScreen();
  expect(await screen.findByDisplayValue('5 km')).toBeTruthy();
  expect(screen.getByText('Zdjęcia (1/5)')).toBeTruthy();
});

test('saving sends the new category and description', async () => {
  mockApi.patch.mockResolvedValue(entry.workouts[0]);
  await renderScreen();
  await fireEvent.changeText(await screen.findByDisplayValue('5 km'), '10 km');
  await fireEvent.press(await screen.findByText('Rower'));
  await fireEvent.press(screen.getByText('Zapisz zmiany'));

  await waitFor(() =>
    expect(mockApi.patch).toHaveBeenCalledWith('/workouts/w1', {
      category_id: 2,
      description: '10 km',
    }),
  );
  await waitFor(() => expect(mockBack).toHaveBeenCalled());
});

test('a photo is removed only after confirming', async () => {
  mockApi.del.mockResolvedValue(undefined);
  await renderScreen();
  await fireEvent.press(await screen.findByLabelText('Usuń zdjęcie'));

  expect(mockApi.del).not.toHaveBeenCalled();
  confirmAlert();
  await waitFor(() => expect(mockApi.del).toHaveBeenCalledWith('/photos/p1'));
});

test('a new photo is uploaded to this workout', async () => {
  mockPick.mockResolvedValue(['file:///a.jpg']);
  mockApi.upload.mockResolvedValue({ id: 'p9', url: null });
  await renderScreen();
  await fireEvent.press(await screen.findByText('Galeria'));

  await waitFor(() =>
    expect(mockApi.upload).toHaveBeenCalledWith(
      '/workouts/w1/photos',
      expect.anything(),
    ),
  );
  expect(mockPick).toHaveBeenCalledWith('gallery', 4);
});

test('deleting the workout asks first, then goes back', async () => {
  mockApi.del.mockResolvedValue(undefined);
  await renderScreen();
  await fireEvent.press(await screen.findByText('Usuń trening'));

  expect(mockApi.del).not.toHaveBeenCalled();
  confirmAlert();
  await waitFor(() => expect(mockApi.del).toHaveBeenCalledWith('/workouts/w1'));
  await waitFor(() => expect(mockBack).toHaveBeenCalled());
});
