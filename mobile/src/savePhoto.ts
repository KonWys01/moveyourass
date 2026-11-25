import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';

const SAF = FileSystem.StorageAccessFramework;
const DIR_KEY = 'photoSaveDir';

export type SaveResult = 'saved' | 'cancelled';

/**
 * Saves a photo into a folder on the phone. Android asks once which
 * folder (Pictures is suggested); the choice is remembered, so later
 * saves are one tap. No extra native module needed (Storage Access
 * Framework from expo-file-system).
 */
export async function savePhoto(url: string, id: string): Promise<SaveResult> {
  if (!url.startsWith('https://')) throw new Error('Nieprawidłowy adres zdjęcia');
  const tmp = `${FileSystem.cacheDirectory}photo-${id}.jpg`;
  try {
    const res = await FileSystem.downloadAsync(url, tmp);
    if (res.status !== 200) {
      throw new Error(`Serwer odpowiedział kodem ${res.status}`);
    }
    const data = await FileSystem.readAsStringAsync(tmp, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const name = `moveyourass-${id}`;
    const write = async (dir: string) => {
      const uri = await SAF.createFileAsync(dir, name, 'image/jpeg');
      await FileSystem.writeAsStringAsync(uri, data, {
        encoding: FileSystem.EncodingType.Base64,
      });
    };

    const remembered = await SecureStore.getItemAsync(DIR_KEY);
    if (remembered) {
      try {
        await write(remembered);
        return 'saved';
      } catch {
        // folder gone or access revoked: ask again below
        await SecureStore.deleteItemAsync(DIR_KEY);
      }
    }
    const perm = await SAF.requestDirectoryPermissionsAsync(
      SAF.getUriForDirectoryInRoot('Pictures'),
    );
    if (!perm.granted) return 'cancelled';
    await SecureStore.setItemAsync(DIR_KEY, perm.directoryUri);
    await write(perm.directoryUri);
    return 'saved';
  } finally {
    await FileSystem.deleteAsync(tmp, { idempotent: true }).catch(
      () => undefined,
    );
  }
}
