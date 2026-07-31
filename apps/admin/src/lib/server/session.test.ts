// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkAdminSession, hasValidAdminSession } from './session';

/** The distinction these pin is the one that decides whether an API hiccup
 * logs every admin out: a rejection is a verdict, a failure to answer is not. */

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('checkAdminSession', () => {
  it('reports valid when the API accepts the token', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    expect(await checkAdminSession('token')).toBe('valid');
  });

  it('reports invalid when the API rejects the token', async () => {
    for (const status of [401, 403]) {
      fetchMock.mockResolvedValue(new Response('{}', { status }));
      expect({ status, result: await checkAdminSession('token') }).toEqual({
        status,
        result: 'invalid',
      });
    }
  });

  it('reports invalid without a network call when there is no token', async () => {
    expect(await checkAdminSession(undefined)).toBe('invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports indeterminate when the API errors rather than answering', async () => {
    for (const status of [500, 502, 503, 504]) {
      fetchMock.mockResolvedValue(new Response('{}', { status }));
      expect({ status, result: await checkAdminSession('token') }).toEqual({
        status,
        result: 'indeterminate',
      });
    }
  });

  it('reports indeterminate when the request fails outright', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    expect(await checkAdminSession('token')).toBe('indeterminate');
  });

  it('reports indeterminate when the request times out', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error('timed out'), { name: 'TimeoutError' }),
    );
    expect(await checkAdminSession('token')).toBe('indeterminate');
  });

  it('sends the token as a cookie, never in the URL or a body', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await checkAdminSession('tok en/value');
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.search).toBe('');
    expect(init.body).toBeUndefined();
    expect(
      (init.headers as Record<string, string>).cookie,
    ).toContain(encodeURIComponent('tok en/value'));
  });

  it('does not cache the verdict', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await checkAdminSession('token');
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.cache).toBe('no-store');
  });
});

describe('hasValidAdminSession', () => {
  it('is true only for a positively valid session', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    expect(await hasValidAdminSession('token')).toBe(true);
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }));
    expect(await hasValidAdminSession('token')).toBe(false);
  });
});
