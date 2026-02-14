import { clearAuthToken, getAuthToken } from '@/shared/authStorage';

export interface ApiJsonResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

export async function apiFetchJson<T>(path: string, init: RequestInit = {}): Promise<ApiJsonResult<T>> {
  const headers = new Headers(init.headers ?? {});
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, DEFAULT_REQUEST_TIMEOUT_MS);
  if (init.signal) {
    init.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    window.clearTimeout(timeoutId);
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'Request timed out. Please try again.'
        : 'Network error. Please check your connection.';
    return {
      ok: false,
      status: 0,
      data: null,
      error: message,
    };
  }
  window.clearTimeout(timeoutId);

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 401) {
    clearAuthToken();
  }

  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  const ok = response.ok && (record?.ok === undefined || record?.ok === true);
  const error =
    typeof record?.error === 'string'
      ? record.error
      : ok
        ? undefined
        : `Request failed with status ${response.status}`;

  return {
    ok,
    status: response.status,
    data: (payload as T | null) ?? null,
    error,
  };
}
