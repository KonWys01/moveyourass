import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

export const APK_MIME = 'application/vnd.android.package-archive';
const FLAG_GRANT_READ_URI_PERMISSION = 1;

export type DownloadProgress = { received: number; total: number };

export class UpdateError extends Error {}

/**
 * Downloads the APK into the app cache. `total` is 0 when the server
 * does not announce a size (GitHub redirects often do not).
 */
export async function downloadApk(
  url: string,
  onProgress: (p: DownloadProgress) => void,
): Promise<string> {
  if (!url.startsWith('https://')) {
    throw new UpdateError('Adres aktualizacji musi zaczynać się od https://');
  }
  const dir = `${FileSystem.cacheDirectory}update/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
    () => undefined, // already exists
  );
  const dest = `${dir}moveyourass.apk`;
  await FileSystem.deleteAsync(dest, { idempotent: true }); // no stale file

  const task = FileSystem.createDownloadResumable(
    url,
    dest,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) =>
      onProgress({
        received: totalBytesWritten,
        total: Math.max(totalBytesExpectedToWrite, 0),
      }),
  );
  const result = await task.downloadAsync();
  if (!result || result.status !== 200) {
    throw new UpdateError(
      `Serwer odpowiedział kodem ${result?.status ?? 'brak'}`,
    );
  }
  return result.uri;
}

/**
 * Hands the APK to Android's package installer. Android itself checks
 * that the new APK is signed with the same key as the installed app, so
 * a forged file cannot replace the app.
 */
export async function launchInstaller(fileUri: string): Promise<void> {
  const contentUri = await FileSystem.getContentUriAsync(fileUri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
    type: APK_MIME,
  });
}

export async function installUpdate(
  url: string,
  onProgress: (p: DownloadProgress) => void,
  onInstalling: () => void,
): Promise<void> {
  const file = await downloadApk(url, onProgress);
  onInstalling();
  await launchInstaller(file);
}

/** "Install unknown apps" page of this app (Android asks for it once). */
export async function openInstallPermissionSettings(): Promise<void> {
  await IntentLauncher.startActivityAsync(
    IntentLauncher.ActivityAction.MANAGE_UNKNOWN_APP_SOURCES,
    { data: `package:${Application.applicationId}` },
  );
}

export function progressLabel(p: DownloadProgress | null): string {
  if (!p) return 'Pobieranie…';
  if (p.total > 0) {
    return `Pobieranie… ${Math.min(100, Math.round((p.received / p.total) * 100))}%`;
  }
  return `Pobieranie… ${(p.received / 1048576).toFixed(1)} MB`;
}
