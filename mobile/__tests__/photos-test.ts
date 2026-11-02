import { buildPhotoForm } from '@/api/photos';

test('photo form has a file part named like the backend expects', () => {
  const append = jest.spyOn(FormData.prototype, 'append');

  buildPhotoForm('file:///tmp/a.jpg');

  expect(append).toHaveBeenCalledWith(
    'file',
    expect.objectContaining({
      uri: 'file:///tmp/a.jpg',
      type: 'image/jpeg',
      name: 'photo.jpg',
    }),
  );
  append.mockRestore();
});
