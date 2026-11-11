import {
  APK_MIME,
  UpdateError,
  downloadApk,
  installUpdate,
  launchInstaller,
  openInstallPermissionSettings,
  progressLabel,
} from '@/update';

const mockFs = {
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
  getContentUriAsync: jest.fn(),
  createDownloadResumable: jest.fn(),
};
jest.mock('expo-file-system/legacy', () => ({
  get cacheDirectory() {
    return mockFs.cacheDirectory;
  },
  makeDirectoryAsync: (...a: unknown[]) => mockFs.makeDirectoryAsync(...a),
  deleteAsync: (...a: unknown[]) => mockFs.deleteAsync(...a),
  getContentUriAsync: (...a: unknown[]) => mockFs.getContentUriAsync(...a),
  createDownloadResumable: (...a: unknown[]) =>
    mockFs.createDownloadResumable(...a),
}));

const mockStart = jest.fn();
jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: (...a: unknown[]) => mockStart(...a),
  ActivityAction: {
    MANAGE_UNKNOWN_APP_SOURCES: 'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
  },
}));
jest.mock('expo-application', () => ({
  applicationId: 'com.konwys01.moveyourass',
}));

const URL = 'https://github.com/o/r/releases/download/v0.2.0/moveyourass.apk';

function download(result: unknown, progress?: [number, number][]) {
  mockFs.createDownloadResumable.mockImplementation(
    (_url: string, _dest: string, _opts: unknown, cb: (p: unknown) => void) => ({
      downloadAsync: async () => {
        for (const [w, t] of progress ?? []) {
          cb({ totalBytesWritten: w, totalBytesExpectedToWrite: t });
        }
        return result;
      },
    }),
  );
}

beforeEach(() => {
  Object.values(mockFs).forEach((f) => typeof f === 'function' && f.mockReset());
  mockStart.mockReset();
  mockFs.makeDirectoryAsync.mockResolvedValue(undefined);
  mockFs.deleteAsync.mockResolvedValue(undefined);
  mockFs.getContentUriAsync.mockResolvedValue('content://fp/update.apk');
  mockStart.mockResolvedValue({ resultCode: 0 });
});

test('downloads into the cache after removing a stale file, reporting progress', async () => {
  download({ status: 200, uri: 'file:///cache/update/moveyourass.apk' }, [
    [10, 100],
    [100, 100],
  ]);
  const seen: unknown[] = [];

  const uri = await downloadApk(URL, (p) => seen.push(p));

  expect(uri).toBe('file:///cache/update/moveyourass.apk');
  expect(mockFs.deleteAsync).toHaveBeenCalledWith(
    'file:///cache/update/moveyourass.apk',
    { idempotent: true },
  );
  expect(mockFs.createDownloadResumable.mock.calls[0][0]).toBe(URL);
  expect(mockFs.createDownloadResumable.mock.calls[0][1]).toBe(
    'file:///cache/update/moveyourass.apk',
  );
  expect(seen).toEqual([
    { received: 10, total: 100 },
    { received: 100, total: 100 },
  ]);
});

test('unknown total size (GitHub redirect) is reported as 0, not -1', async () => {
  download({ status: 200, uri: 'file:///f.apk' }, [[2048, -1]]);
  const seen: { received: number; total: number }[] = [];

  await downloadApk(URL, (p) => seen.push(p));

  expect(seen[0]).toEqual({ received: 2048, total: 0 });
});

test('refuses non-https addresses before touching the network', async () => {
  await expect(
    downloadApk('http://evil.example/x.apk', () => {}),
  ).rejects.toThrow(UpdateError);

  expect(mockFs.createDownloadResumable).not.toHaveBeenCalled();
});

test('a non-200 answer is an error, not an installable file', async () => {
  download({ status: 404, uri: 'file:///f.apk' });

  await expect(downloadApk(URL, () => {})).rejects.toThrow('404');
});

test('opens the installer with a content URI, read permission and APK type', async () => {
  await launchInstaller('file:///cache/update/moveyourass.apk');

  expect(mockFs.getContentUriAsync).toHaveBeenCalledWith(
    'file:///cache/update/moveyourass.apk',
  );
  expect(mockStart).toHaveBeenCalledWith('android.intent.action.VIEW', {
    data: 'content://fp/update.apk',
    flags: 1,
    type: APK_MIME,
  });
  expect(APK_MIME).toBe('application/vnd.android.package-archive');
});

test('installUpdate: download first, then installing, then installer', async () => {
  download({ status: 200, uri: 'file:///f.apk' });
  const order: string[] = [];
  mockStart.mockImplementation(async () => {
    order.push('installer');
  });

  await installUpdate(
    URL,
    () => {},
    () => order.push('installing'),
  );

  expect(order).toEqual(['installing', 'installer']);
});

test('a failed download never opens the installer', async () => {
  download({ status: 500, uri: 'x' });

  await expect(
    installUpdate(URL, () => {}, () => {}),
  ).rejects.toThrow();

  expect(mockStart).not.toHaveBeenCalled();
});

test('settings shortcut targets this app package', async () => {
  await openInstallPermissionSettings();

  expect(mockStart).toHaveBeenCalledWith(
    'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
    { data: 'package:com.konwys01.moveyourass' },
  );
});

test('progress label: percent when known, megabytes otherwise', () => {
  expect(progressLabel(null)).toBe('Pobieranie…');
  expect(progressLabel({ received: 40, total: 100 })).toBe('Pobieranie… 40%');
  expect(progressLabel({ received: 150, total: 100 })).toBe('Pobieranie… 100%');
  expect(progressLabel({ received: 3 * 1048576, total: 0 })).toBe(
    'Pobieranie… 3.0 MB',
  );
});
