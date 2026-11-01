import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, Linking } from 'react-native';

import Settings from '../app/(tabs)/settings';
import { UpdateGate } from '@/components/UpdateGate';
import { Text } from 'react-native';

jest.mock('expo-router', () => ({}));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.0.0' }));
jest.mock('@/config', () => ({ API_URL: 'https://api.test' }));

const mockApi = { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn() };
const mockSignOut = jest.fn();
const mockSetUser = jest.fn();
let mockUser = {
  id: 'me',
  email: 'a@x.com',
  first_name: 'Ala',
  last_name: 'Kot',
  avatar_url: null,
  is_public: true,
  timezone: 'Europe/Warsaw',
  streak_threshold: 3,
  is_admin: false,
};
jest.mock('@/auth/session', () => ({
  useSession: () => ({
    api: mockApi,
    user: mockUser,
    signOut: mockSignOut,
    setUser: mockSetUser,
  }),
}));

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const PREFS = {
  reminder: true,
  like: true,
  comment: true,
  follow_request: true,
  new_follower: true,
  request_accepted: true,
};

beforeEach(() => {
  Object.values(mockApi).forEach((f) => f.mockReset());
  mockSignOut.mockReset();
  mockSetUser.mockReset();
  mockApi.get.mockResolvedValue(PREFS);
});

test('turning a notification off sends only that key', async () => {
  mockApi.patch.mockResolvedValue({ ...PREFS, like: false });
  await wrap(<Settings />);
  const sw = await screen.findByLabelText('Polubienie mojego wpisu');
  await waitFor(() => expect(sw.props.disabled).toBeFalsy());

  await fireEvent(sw, 'valueChange', false);

  await waitFor(() =>
    expect(mockApi.patch).toHaveBeenCalledWith('/me/notifications', {
      like: false,
    }),
  );
});

test('a failed notification update rolls the switch back', async () => {
  mockApi.patch.mockRejectedValue(new Error('500'));
  await wrap(<Settings />);
  const label = 'Komentarz pod moim wpisem';
  const sw = await screen.findByLabelText(label);
  await waitFor(() => expect(sw.props.disabled).toBeFalsy());

  await fireEvent(sw, 'valueChange', false);

  await waitFor(() =>
    expect(screen.getByLabelText(label).props.value).toBe(true),
  );
});

test('goal stepper changes the threshold within 1..7', async () => {
  mockApi.patch.mockResolvedValue({ ...mockUser, streak_threshold: 4 });
  await wrap(<Settings />);

  await fireEvent.press(await screen.findByText('+'));
  await waitFor(() =>
    expect(mockApi.patch).toHaveBeenCalledWith('/me', {
      streak_threshold: 4,
    }),
  );
  await waitFor(() => expect(mockSetUser).toHaveBeenCalled());
});

const DEFAULT_USER = { ...mockUser };
afterEach(() => {
  mockUser = { ...DEFAULT_USER };
});

test('cannot go below 1', async () => {
  mockUser = { ...mockUser, streak_threshold: 1 };
  await wrap(<Settings />);

  await fireEvent.press(await screen.findByText('−'));

  expect(mockApi.patch).not.toHaveBeenCalled();
});

test('cannot go above 7', async () => {
  mockUser = { ...mockUser, streak_threshold: 7 };
  await wrap(<Settings />);

  await fireEvent.press(await screen.findByText('+'));

  expect(mockApi.patch).not.toHaveBeenCalled();
});

test('privacy toggle patches is_public', async () => {
  mockApi.patch.mockResolvedValue({ ...mockUser, is_public: false });
  await wrap(<Settings />);

  await fireEvent(
    await screen.findByLabelText('Profil publiczny'),
    'valueChange',
    false,
  );

  await waitFor(() =>
    expect(mockApi.patch).toHaveBeenCalledWith('/me', { is_public: false }),
  );
});

test('delete account asks first, then deletes and signs out', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockApi.del.mockResolvedValue(undefined);
  await wrap(<Settings />);

  await fireEvent.press(await screen.findByText('Usuń konto'));

  expect(mockApi.del).not.toHaveBeenCalled(); // nothing before confirming
  const buttons = alert.mock.calls[0][2] as {
    text: string;
    onPress?: () => void;
  }[];
  buttons.find((b) => b.text === 'Usuń konto')!.onPress!();

  await waitFor(() => expect(mockApi.del).toHaveBeenCalledWith('/me'));
  await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  alert.mockRestore();
});

test('failed account deletion keeps the user signed in', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockApi.del.mockRejectedValue(new Error('Brak połączenia'));
  await wrap(<Settings />);
  await fireEvent.press(await screen.findByText('Usuń konto'));
  (alert.mock.calls[0][2] as { text: string; onPress?: () => void }[])
    .find((b) => b.text === 'Usuń konto')!
    .onPress!();

  expect(await screen.findByText('Brak połączenia')).toBeTruthy();
  expect(mockSignOut).not.toHaveBeenCalled();
  alert.mockRestore();
});

test('privacy policy opens the backend page', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await wrap(<Settings />);

  await fireEvent.press(await screen.findByText('Polityka prywatności'));

  expect(open).toHaveBeenCalledWith('https://api.test/privacy');
  open.mockRestore();
});

describe('update gate', () => {
  const app = (
    <UpdateGate>
      <Text>aplikacja</Text>
    </UpdateGate>
  );

  test('blocks when the version is below the minimum', async () => {
    mockApi.get.mockResolvedValue({
      current_version: '0.1.0',
      latest_version: '1.3.0',
      min_version: '1.1.0',
      download_url: 'https://dl.example/app.apk',
      update_available: true,
      update_required: true,
    });
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await wrap(app);

    expect(await screen.findByText('Wymagana aktualizacja')).toBeTruthy();
    expect(screen.queryByText('aplikacja')).toBeNull();
    await fireEvent.press(screen.getByText('Pobierz aktualizację'));
    expect(open).toHaveBeenCalledWith('https://dl.example/app.apk');
    open.mockRestore();
  });

  test('lets the app through when only an update is available', async () => {
    mockApi.get.mockResolvedValue({
      update_available: true,
      update_required: false,
    });
    await wrap(app);

    expect(await screen.findByText('aplikacja')).toBeTruthy();
  });

  test('never locks the user out when the check fails', async () => {
    mockApi.get.mockRejectedValue(new Error('offline'));
    await wrap(app);

    expect(await screen.findByText('aplikacja')).toBeTruthy();
  });
});
