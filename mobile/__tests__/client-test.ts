import { ApiError, createApi } from '@/api/client';

function fakeFetch(status: number, body?: unknown) {
  return jest.fn(async () => ({
    status,
    ok: status >= 200 && status < 300,
    text: async () =>
      body === undefined
        ? ''
        : typeof body === 'string'
          ? body
          : JSON.stringify(body),
  })) as unknown as jest.MockedFunction<typeof fetch> & typeof fetch;
}

async function failure(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected rejection');
}

function make(fetchImpl: typeof fetch, token: string | null = 't0k') {
  const onUnauthorized = jest.fn();
  const api = createApi({
    baseUrl: 'https://api.test',
    appVersion: '1.2.3',
    getToken: () => token,
    onUnauthorized,
    fetchImpl,
  });
  return { api, onUnauthorized };
}

test('sends auth and version headers and parses json', async () => {
  const f = fakeFetch(200, { ok: true });
  const { api } = make(f);

  const res = await api.get<{ ok: boolean }>('/me');

  expect(res).toEqual({ ok: true });
  const [url, init] = (f as jest.Mock).mock.calls[0];
  expect(url).toBe('https://api.test/me');
  expect(init.headers.Authorization).toBe('Bearer t0k');
  expect(init.headers['X-App-Version']).toBe('1.2.3');
});

test('omits Authorization without a token', async () => {
  const f = fakeFetch(200, {});
  const { api } = make(f, null);

  await api.get('/app/version');

  expect((f as jest.Mock).mock.calls[0][1].headers.Authorization).toBe(
    undefined,
  );
});

test('encodes query and skips undefined values', async () => {
  const f = fakeFetch(200, []);
  const { api } = make(f);

  await api.get('/users/search', { q: 'ala ma', x: undefined, n: 2 });

  expect((f as jest.Mock).mock.calls[0][0]).toBe(
    'https://api.test/users/search?q=ala%20ma&n=2',
  );
});

test('posts json with content type', async () => {
  const f = fakeFetch(201, { id: 1 });
  const { api } = make(f);

  await api.post('/entries/rest', { a: 1 });

  const init = (f as jest.Mock).mock.calls[0][1];
  expect(init.method).toBe('POST');
  expect(init.headers['Content-Type']).toBe('application/json');
  expect(init.body).toBe('{"a":1}');
});

test('upload sends FormData without forcing content type', async () => {
  const f = fakeFetch(201, { id: 'p' });
  const { api } = make(f);
  const form = new FormData();

  await api.upload('/workouts/1/photos', form);

  const init = (f as jest.Mock).mock.calls[0][1];
  expect(init.body).toBe(form);
  expect(init.headers['Content-Type']).toBeUndefined();
});

test('204 resolves to undefined', async () => {
  const { api } = make(fakeFetch(204));

  await expect(api.del('/photos/1')).resolves.toBeUndefined();
});

test('error carries status and backend detail', async () => {
  const { api } = make(fakeFetch(409, { detail: 'Photo limit reached' }));

  const err = await failure(api.post('/x'));

  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(409);
  expect(err.message).toBe('Photo limit reached');
});

test('401 with a token triggers onUnauthorized', async () => {
  const { api, onUnauthorized } = make(fakeFetch(401, { detail: 'x' }));

  await expect(api.get('/me')).rejects.toBeInstanceOf(ApiError);

  expect(onUnauthorized).toHaveBeenCalledTimes(1);
});

test('401 without a token (failed login) does not sign out', async () => {
  const { api, onUnauthorized } = make(
    fakeFetch(401, { detail: 'Invalid Google token' }),
    null,
  );

  await expect(api.post('/auth/google')).rejects.toThrow(
    'Invalid Google token',
  );

  expect(onUnauthorized).not.toHaveBeenCalled();
});

test('network failure becomes ApiError status 0', async () => {
  const f = jest.fn(async () => {
    throw new TypeError('Network request failed');
  }) as unknown as typeof fetch;
  const { api } = make(f);

  const err = await failure(api.get('/me'));

  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(0);
});

test('network failure keeps the original reason for diagnosis', async () => {
  const f = jest.fn(async () => {
    throw new TypeError('Network request failed');
  }) as unknown as typeof fetch;
  const { api } = make(f);

  const err = await failure(api.get('/me'));

  expect(err.status).toBe(0);
  expect(err.message).toContain('Brak połączenia z serwerem');
  expect(err.message).toContain('Network request failed');
});

test('non-json error body does not crash', async () => {
  const { api } = make(fakeFetch(502, '<html>bad gateway</html>'));

  const err = await failure(api.get('/me'));

  expect(err.status).toBe(502);
});
