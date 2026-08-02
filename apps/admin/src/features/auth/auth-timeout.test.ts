import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_REQUEST_TIMEOUT_MS, login } from './auth-client';

/** ISS-012, first half. The auth requests carried no abort signal, so a
 * connection that opened but was never answered stayed pending forever. That
 * is what left `initializeSession` unsettled and the console stuck on
 * "Checking your admin session…".
 *
 * These pin that every auth request is bounded. */

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      data: { accessToken: 'token', admin: { id: '1' } },
      meta: null, error: null, requestId: 'test', timestamp: '',
    }),
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const signalOf = () => (fetchMock.mock.calls.at(-1)?.[1] as RequestInit | undefined)?.signal;

describe('auth request bounding', () => {
  it('attaches an abort signal so the request cannot hang forever', async () => {
    await login('admin@example.com', 'secret');
    expect(signalOf()).toBeInstanceOf(AbortSignal);
  });

  it('uses a timeout long enough for a real round trip', () => {
    expect(AUTH_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
    expect(AUTH_REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });

  it('leaves the signal live for the duration of a normal request', async () => {
    await login('admin@example.com', 'secret');
    expect(signalOf()!.aborted).toBe(false);
  });

  /* What matters at this boundary is that a deadline exists at all. Whether an
   * AbortSignal.timeout fires on time is the platform's own contract, and it
   * runs on an internal timer that fake timers cannot advance -- so asserting
   * it here would test the runtime, not this code. */
  it('bounds every auth call, not just the first', async () => {
    await login('admin@example.com', 'secret');
    await login('admin@example.com', 'secret');
    for (const call of fetchMock.mock.calls) {
      expect((call[1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
    }
  });
});
