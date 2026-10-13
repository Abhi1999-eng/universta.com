import { afterEach, describe, expect, it } from 'vitest';
import { WEB_ORIGIN_ATTRIBUTE, configuredWebOrigin, webOrigin } from './web-origin';

/**
 * Every "View live" link in the Admin opened http://localhost:3000 on the
 * demo server. The Admin is built in CI, which cannot know the host, so a
 * build-time variable was always the fallback. The origin is now read at
 * request time on the server and handed to the browser on the document.
 */

const saved = { WEB_ORIGIN: process.env.WEB_ORIGIN, NEXT_PUBLIC_WEB_ORIGIN: process.env.NEXT_PUBLIC_WEB_ORIGIN };

afterEach(() => {
  process.env.WEB_ORIGIN = saved.WEB_ORIGIN;
  process.env.NEXT_PUBLIC_WEB_ORIGIN = saved.NEXT_PUBLIC_WEB_ORIGIN;
  if (saved.WEB_ORIGIN === undefined) delete process.env.WEB_ORIGIN;
  if (saved.NEXT_PUBLIC_WEB_ORIGIN === undefined) delete process.env.NEXT_PUBLIC_WEB_ORIGIN;
  document.documentElement.removeAttribute(WEB_ORIGIN_ATTRIBUTE);
});

describe('where the public site lives', () => {
  it('is the deploy-time WEB_ORIGIN on the server, without a trailing slash', () => {
    process.env.WEB_ORIGIN = 'https://54.162.49.131.nip.io/';
    expect(configuredWebOrigin()).toBe('https://54.162.49.131.nip.io');
  });

  it('falls back to the local site when nothing is configured', () => {
    delete process.env.WEB_ORIGIN;
    delete process.env.NEXT_PUBLIC_WEB_ORIGIN;
    expect(configuredWebOrigin()).toBe('http://localhost:3000');
  });

  it('is read from the document in the browser, where the layout wrote it', () => {
    document.documentElement.setAttribute(WEB_ORIGIN_ATTRIBUTE, 'https://54.162.49.131.nip.io');
    expect(webOrigin()).toBe('https://54.162.49.131.nip.io');
  });

  it('still points at the local site when the layout wrote nothing', () => {
    expect(webOrigin()).toBe('http://localhost:3000');
  });
});
