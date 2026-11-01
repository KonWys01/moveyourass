import * as ImagePicker from 'expo-image-picker';

export const MAX_PHOTOS = 5;

/** Multipart body the backend expects (`file` field, JPEG). */
export function buildPhotoForm(uri: string): FormData {
  const form = new FormData();
  form.append('file', {
    uri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  return form;
}

export type PickSource = 'camera' | 'gallery';

/** Returns picked image URIs ([] if cancelled / permission denied). */
export async function pickPhotos(
  source: PickSource,
  max: number,
): Promise<string[]> {
  if (max <= 0) return [];
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return [];
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    return res.canceled ? [] : res.assets.map((a) => a.uri);
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: max > 1,
    selectionLimit: max,
    quality: 0.8,
  });
  return res.canceled ? [] : res.assets.slice(0, max).map((a) => a.uri);
}
