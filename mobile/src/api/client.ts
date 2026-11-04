export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: unknown,
  ) {
    super(
      typeof detail === 'string' ? detail : `Błąd serwera (${status})`,
    );
  }
}

export type ApiOptions = {
  baseUrl: string;
  appVersion: string;
  getToken: () => string | null;
  onUnauthorized?: () => void;
  fetchImpl?: typeof fetch;
};

type RequestOptions = {
  query?: Record<string, string | number | boolean | undefined>;
  json?: unknown;
  form?: FormData;
};

export function createApi(opts: ApiOptions) {
  const doFetch = opts.fetchImpl ?? fetch;

  async function request<T>(
    method: string,
    path: string,
    { query, json, form }: RequestOptions = {},
  ): Promise<T> {
    const qs = query
      ? '?' +
        Object.entries(query)
          .filter(([, v]) => v !== undefined)
          .map(
            ([k, v]) =>
              `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
          )
          .join('&')
      : '';
    const headers: Record<string, string> = {
      'X-App-Version': opts.appVersion,
      Accept: 'application/json',
    };
    const token = opts.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let body: BodyInit | undefined;
    if (form) {
      body = form; // fetch sets the multipart boundary itself
    } else if (json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    }

    let response: Response;
    try {
      response = await doFetch(`${opts.baseUrl}${path}${qs}`, {
        method,
        headers,
        body,
      });
    } catch (e) {
      // keep the original reason ("Network request failed", unreadable
      // file, ...): without it a failed upload cannot be diagnosed
      const reason = e instanceof Error && e.message ? ` (${e.message})` : '';
      throw new ApiError(0, `Brak połączenia z serwerem${reason}`);
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    let data: unknown = undefined;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }
    if (!response.ok) {
      if (response.status === 401 && token) opts.onUnauthorized?.();
      const detail =
        data && typeof data === 'object' && 'detail' in data
          ? (data as { detail: unknown }).detail
          : data;
      throw new ApiError(response.status, detail);
    }
    return data as T;
  }

  return {
    get: <T>(path: string, query?: RequestOptions['query']) =>
      request<T>('GET', path, { query }),
    post: <T>(path: string, json?: unknown) =>
      request<T>('POST', path, { json }),
    patch: <T>(path: string, json?: unknown) =>
      request<T>('PATCH', path, { json }),
    del: <T = void>(path: string) => request<T>('DELETE', path),
    upload: <T>(path: string, form: FormData) =>
      request<T>('POST', path, { form }),
  };
}

export type Api = ReturnType<typeof createApi>;
