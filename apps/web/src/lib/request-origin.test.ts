import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { originAllowed } from './request-origin';

/**
 * The live contact form answered every visitor with 403: the route compared
 * the request's Origin with a build-time value that CI leaves at
 * http://localhost:3000. These pin the check to what the request and the
 * runtime environment say.
 */
const post = (url: string, origin?: string) =>
  new NextRequest(url, { method: 'POST', headers: origin ? { origin } : {} });

afterEach(() => vi.unstubAllEnvs());

describe('which origins may post to the form routes', () => {
  it('accepts the origin the request arrived on, with nothing configured', () => {
    vi.stubEnv('WEB_ORIGIN', '');
    vi.stubEnv('NEXT_PUBLIC_WEB_ORIGIN', '');
    expect(originAllowed(post('https://universta.example/api/contact-inquiries', 'https://universta.example'))).toBe(true);
  });

  it('accepts the runtime WEB_ORIGIN when the server sits behind a proxy', () => {
    vi.stubEnv('WEB_ORIGIN', 'https://54.162.49.131.nip.io');
    expect(originAllowed(post('http://127.0.0.1:3000/api/contact-inquiries', 'https://54.162.49.131.nip.io'))).toBe(true);
  });

  it('refuses another site', () => {
    vi.stubEnv('WEB_ORIGIN', 'https://54.162.49.131.nip.io');
    expect(originAllowed(post('http://127.0.0.1:3000/api/contact-inquiries', 'https://evil.example'))).toBe(false);
  });

  it('allows a request with no Origin header, as before', () => {
    expect(originAllowed(post('http://127.0.0.1:3000/api/contact-inquiries'))).toBe(true);
  });
});
