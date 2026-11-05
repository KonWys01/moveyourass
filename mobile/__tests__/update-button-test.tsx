import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { UpdateButton } from '@/components/UpdateButton';

const mockInstall = jest.fn();
const mockSettings = jest.fn();
jest.mock('@/update', () => ({
  ...jest.requireActual('@/update'),
  installUpdate: (...a: unknown[]) => mockInstall(...a),
  openInstallPermissionSettings: () => mockSettings(),
}));
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-intent-launcher', () => ({}));
jest.mock('expo-application', () => ({}));

const URL = 'https://dl.example/app.apk';

beforeEach(() => {
  mockInstall.mockReset();
  mockSettings.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('starts the download with the given URL', async () => {
  mockInstall.mockResolvedValue(undefined);
  await render(<UpdateButton url={URL} />);

  await fireEvent.press(screen.getByText('Zainstaluj aktualizację'));

  await waitFor(() => expect(mockInstall).toHaveBeenCalledTimes(1));
  expect(mockInstall.mock.calls[0][0]).toBe(URL);
});

test('shows progress and then the installer step', async () => {
  let finish: () => void = () => {};
  mockInstall.mockImplementation(
    async (
      _url: string,
      onProgress: (p: { received: number; total: number }) => void,
      onInstalling: () => void,
    ) => {
      onProgress({ received: 40, total: 100 });
      await new Promise<void>((r) => {
        finish = r;
      });
      onInstalling();
      await new Promise<void>(() => {}); // installer stays open
    },
  );
  await render(<UpdateButton url={URL} />);

  await fireEvent.press(screen.getByText('Zainstaluj aktualizację'));
  expect(await screen.findByText('Pobieranie… 40%')).toBeTruthy();

  await act(async () => finish());
  expect(await screen.findByText('Otwieranie instalatora…')).toBeTruthy();
});

test('a double tap starts only one download', async () => {
  mockInstall.mockImplementation(() => new Promise(() => {}));
  await render(<UpdateButton url={URL} />);

  const press = screen.getByText('Zainstaluj aktualizację');
  await fireEvent.press(press);
  await fireEvent.press(press);

  expect(mockInstall).toHaveBeenCalledTimes(1);
});

test('a failure explains itself and offers the fallbacks', async () => {
  mockInstall.mockRejectedValue(new Error('Serwer odpowiedział kodem 404'));
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(<UpdateButton url={URL} />);

  await fireEvent.press(screen.getByText('Zainstaluj aktualizację'));

  expect(
    await screen.findByText('Nie udało się: Serwer odpowiedział kodem 404'),
  ).toBeTruthy();
  await fireEvent.press(screen.getByText('Pobierz w przeglądarce'));
  expect(open).toHaveBeenCalledWith(URL);
  await fireEvent.press(screen.getByText('Zezwól na instalowanie'));
  expect(mockSettings).toHaveBeenCalled();
});

test('after a failure it can be retried', async () => {
  mockInstall.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(undefined);
  await render(<UpdateButton url={URL} />);

  await fireEvent.press(screen.getByText('Zainstaluj aktualizację'));
  await fireEvent.press(await screen.findByText('Spróbuj ponownie'));

  await waitFor(() => expect(mockInstall).toHaveBeenCalledTimes(2));
});

test('hint to allow unknown sources after the installer closed unfinished', async () => {
  mockInstall.mockResolvedValue(undefined); // returned without the app being replaced
  await render(<UpdateButton url={URL} />);

  await fireEvent.press(screen.getByText('Zainstaluj aktualizację'));

  expect(await screen.findByText(/nieznanych źródeł/)).toBeTruthy();
  expect(screen.getByText('Zezwól na instalowanie')).toBeTruthy();
});

test('no URL means the button is disabled', async () => {
  await render(<UpdateButton url="" />);

  await fireEvent.press(screen.getByText('Zainstaluj aktualizację'));

  expect(mockInstall).not.toHaveBeenCalled();
});
