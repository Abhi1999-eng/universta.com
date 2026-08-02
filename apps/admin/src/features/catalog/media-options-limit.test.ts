import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MEDIA_OPTIONS_MAX_LIMIT, listEditorialMedia } from './catalog-client';

/** ISS-011. `MediaOptionsQueryDto` declares `@Max(50)` on `limit`, so
 * `/admin/media-options?limit=100` answers 400 VALIDATION_ERROR. Both the
 * Subject and Course editors asked for 100, so neither ever received a media
 * list: every picker showed "No media selected" even for records that had an
 * image attached, and the Subject editor swallowed the rejection outright.
 *
 * These pin that no call site can exceed the server's documented cap. */

vi.mock('@/features/auth/auth-client', () => ({
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => fetchMock(input, init),
}));

const fetchMock = vi.fn();

function ok(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data, meta: null, error: null, requestId: 'test', timestamp: '' }),
  } as unknown as Response;
}

const requestedUrl = () => String(fetchMock.mock.calls.at(-1)?.[0]);

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(ok([]));
});

describe('listEditorialMedia limit', () => {
  it('matches the cap the API actually enforces', () => {
    expect(MEDIA_OPTIONS_MAX_LIMIT).toBe(50);
  });

  it('clamps a limit above the cap instead of sending a rejected request', async () => {
    await listEditorialMedia({ limit: 100 });
    expect(requestedUrl()).toContain(`limit=${MEDIA_OPTIONS_MAX_LIMIT}`);
    expect(requestedUrl()).not.toContain('limit=100');
  });

  it('leaves a limit within the cap untouched', async () => {
    await listEditorialMedia({ limit: 24 });
    expect(requestedUrl()).toContain('limit=24');
  });

  it('accepts the cap itself', async () => {
    await listEditorialMedia({ limit: 50 });
    expect(requestedUrl()).toContain('limit=50');
  });

  it('sends no limit at all when none is asked for, so the server default applies', async () => {
    await listEditorialMedia();
    expect(requestedUrl()).not.toContain('limit=');
  });

  it('keeps the search term alongside a clamped limit', async () => {
    await listEditorialMedia({ q: 'campus', limit: 100 });
    expect(requestedUrl()).toContain('q=campus');
    expect(requestedUrl()).toContain(`limit=${MEDIA_OPTIONS_MAX_LIMIT}`);
  });
});
