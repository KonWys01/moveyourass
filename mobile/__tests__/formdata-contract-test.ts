// Regression for the production error "Unsupported FormDataPart
// implementation": runs Expo's REAL multipart conversion on both shapes.
// jest-expo replaces these modules with mocks; we want the real ones
const { convertFormDataAsync } = jest.requireActual(
  'expo/src/winter/fetch/convertFormData',
) as typeof import('expo/src/winter/fetch/convertFormData');
const { installFormDataPatch } = jest.requireActual(
  'expo/src/winter/FormData',
) as typeof import('expo/src/winter/FormData');

class FakeFormData {
  _parts: [string, unknown][] = [];
}
installFormDataPatch(FakeFormData as unknown as typeof FormData);

function form(value: unknown) {
  const f = new FakeFormData() as unknown as FormData;
  (f as unknown as { append: (n: string, v: unknown) => void }).append(
    'file',
    value,
  );
  return f;
}

test('the old React Native {uri,name,type} object is rejected (the bug)', async () => {
  await expect(
    convertFormDataAsync(
      form({ uri: 'file:///a.jpg', name: 'photo.jpg', type: 'image/jpeg' }),
    ),
  ).rejects.toThrow('Unsupported FormDataPart implementation');
});

test('a File-like part (name + bytes) becomes a proper file field', async () => {
  const file = {
    name: 'a.jpeg',
    type: 'image/jpeg',
    bytes: async () => new Uint8Array([1, 2, 3]),
  };

  const { body, boundary } = await convertFormDataAsync(form(file));

  const text = new TextDecoder('latin1').decode(body);
  expect(text).toContain(`--${boundary}`);
  expect(text).toContain('name="file"');
  expect(text).toContain('filename="a.jpeg"'); // FastAPI needs a filename
  expect(text).toContain('content-type: image/jpeg');
  expect(text).toContain('\u0001\u0002\u0003'); // the file bytes are in the body
});
