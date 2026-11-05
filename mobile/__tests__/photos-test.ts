import { buildPhotoForm } from '@/api/photos';

const mockFiles: { uri: string }[] = [];
jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
      mockFiles.push(this);
    }
  },
}));
jest.mock('expo-image-picker', () => ({}));

test('the photo is sent as an expo-file-system File in the `file` field', () => {
  const append = jest.spyOn(FormData.prototype, 'append');

  buildPhotoForm('file:///data/cache/ImagePicker/a.jpeg');

  expect(mockFiles).toHaveLength(1);
  expect(mockFiles[0].uri).toBe('file:///data/cache/ImagePicker/a.jpeg');
  expect(append).toHaveBeenCalledWith('file', mockFiles[0]);
  append.mockRestore();
});

test('never uses the old {uri,name,type} object that Expo fetch rejects', () => {
  const append = jest.spyOn(FormData.prototype, 'append');

  buildPhotoForm('file:///x.jpg');

  const part = append.mock.calls[0][1] as unknown as Record<string, unknown>;
  expect(part).not.toHaveProperty('type');
  append.mockRestore();
});
