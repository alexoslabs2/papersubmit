let csrfToken: string | null = null;

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function ensureCsrf(forceRefresh = false): Promise<string> {
  if (csrfToken && !forceRefresh) return csrfToken;
  const response = await fetch('/csrf-token', { credentials: 'include', cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to refresh CSRF token');
  const data = await response.json();
  csrfToken = data.csrfToken;
  return csrfToken!;
}

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({ error: response.statusText }));
  if (typeof body.message === 'string' && /csrf/i.test(body.message)) return body.message;
  return body.error ?? response.statusText;
}

function isCsrfFailure(response: Response, error: string): boolean {
  return response.status === 403 && /csrf/i.test(error);
}

function shouldRedirectToLogin(path: string, response: Response, error: string): boolean {
  if (path.startsWith('/auth/') || path === '/me' || isCsrfFailure(response, error)) return false;
  return response.status === 401 || response.status === 403;
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const currentPath = `${window.location.pathname}${window.location.search}`;
  const redirect = currentPath && currentPath !== '/login' ? `?redirect=${encodeURIComponent(currentPath)}` : '';
  window.location.assign(`/login${redirect}`);
}

async function request<T>(path: string, options: RequestInit, retryingCsrf: boolean): Promise<T> {
  const method = options.method ?? 'GET';
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && options.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  if (unsafeMethods.has(method.toUpperCase())) {
    headers.set('x-csrf-token', await ensureCsrf(retryingCsrf));
  }
  const response = await fetch(path, {
    ...options,
    method,
    headers,
    credentials: 'include'
  });
  if (!response.ok) {
    const error = await readError(response);
    if (!retryingCsrf && isCsrfFailure(response, error) && unsafeMethods.has(method.toUpperCase())) {
      csrfToken = null;
      return request<T>(path, options, true);
    }
    if (shouldRedirectToLogin(path, response, error)) {
      csrfToken = null;
      redirectToLogin();
    }
    throw new Error(error);
  }
  return response.json() as Promise<T>;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(path, options, false);
}
