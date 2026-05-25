import { beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init.headers
    }
  });
}

async function loadApi() {
  vi.resetModules();
  return import('../../src/web/api.js');
}

describe('web api client', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds a CSRF token header to unsafe requests', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf-token' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await loadApi();
    await api('/admin/proposals/proposal-id/decide', {
      method: 'POST',
      body: JSON.stringify({ decision: 'accepted' })
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const request = fetchMock.mock.calls[1]?.[1];
    const headers = request?.headers as Headers;
    expect(headers.get('x-csrf-token')).toBe('csrf-token');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('refreshes and retries once when an unsafe request has a stale CSRF token', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'old-token' }))
      .mockResolvedValueOnce(jsonResponse({ error: 'Invalid csrf token' }, { status: 403 }))
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'new-token' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await loadApi();
    await expect(
      api('/admin/proposals/proposal-id/decide', {
        method: 'POST',
        body: JSON.stringify({ decision: 'accepted' })
      })
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/csrf-token');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/csrf-token');
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Headers).get('x-csrf-token')).toBe('old-token');
    expect((fetchMock.mock.calls[3]?.[1]?.headers as Headers).get('x-csrf-token')).toBe('new-token');
  });

  it('redirects to login when a protected API request is unauthorized', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: {
        pathname: '/app/proposals',
        search: '?page=1',
        assign
      }
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'Authentication required' }, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await loadApi();
    await expect(api('/proposals')).rejects.toThrow('Authentication required');

    expect(assign).toHaveBeenCalledWith('/login?redirect=%2Fapp%2Fproposals%3Fpage%3D1');
  });

  it('does not redirect failed login attempts back to login', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: {
        pathname: '/login',
        search: '',
        assign
      }
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf-token' }))
      .mockResolvedValueOnce(jsonResponse({ error: 'Invalid email or password' }, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await loadApi();
    await expect(api('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'a@example.com', password: 'bad' }) })).rejects.toThrow(
      'Invalid email or password'
    );

    expect(assign).not.toHaveBeenCalled();
  });
});
