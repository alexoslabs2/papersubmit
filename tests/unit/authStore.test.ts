import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init.headers
    }
  });
}

async function loadAuthStore() {
  vi.resetModules();
  setActivePinia(createPinia());
  return import('../../src/web/stores/authStore.js');
}

describe('auth store password reset actions', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests a password reset through the generic forgot-password endpoint', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf-token' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const { useAuthStore } = await loadAuthStore();
    await useAuthStore().requestPasswordReset('Speaker@Example.com');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/auth/forgot-password');
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('POST');
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ email: 'Speaker@Example.com' }));
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Headers).get('x-csrf-token')).toBe('csrf-token');
  });

  it('submits a new password with the reset token', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf-token' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const { useAuthStore } = await loadAuthStore();
    await useAuthStore().resetPassword('reset-token', 'new-secure-password');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/auth/reset-password');
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('POST');
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ token: 'reset-token', password: 'new-secure-password' }));
  });
});
