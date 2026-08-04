import { describe, expect, it } from 'vitest';
import { titleFromFilename, toEditorialMedia, validateMediaFile } from './media-upload';

function fakeFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('validateMediaFile', () => {
  it('accepts a JPEG under the size cap', () => {
    expect(validateMediaFile(fakeFile('campus.jpg', 'image/jpeg', 1024))).toBeNull();
  });

  it('rejects an unsupported type', () => {
    expect(validateMediaFile(fakeFile('logo.svg', 'image/svg+xml', 1024))).toMatch(/unsupported/i);
  });

  it('rejects a file over 5MB', () => {
    expect(validateMediaFile(fakeFile('huge.png', 'image/png', 5 * 1024 * 1024 + 1))).toMatch(/5MB/);
  });

  it('accepts a file exactly at the 5MB cap', () => {
    expect(validateMediaFile(fakeFile('exact.png', 'image/png', 5 * 1024 * 1024))).toBeNull();
  });
});

describe('titleFromFilename', () => {
  it('turns dashes and underscores into a readable, capitalized title', () => {
    expect(titleFromFilename('ashcroft-college_campus.jpg')).toBe('Ashcroft college campus');
  });

  it('falls back to the raw filename when nothing remains after stripping the extension', () => {
    expect(titleFromFilename('.jpg')).toBe('.jpg');
  });
});

describe('toEditorialMedia', () => {
  it('maps the raw upload response to the EditorialMedia shape and rewrites the media URL', () => {
    const asset = {
      id: 'm1',
      publicUrl: '/media/foo.jpg',
      title: 'Foo',
      altText: 'Foo alt',
      width: 100,
      height: 200,
      originalFileName: 'foo.jpg',
    };
    expect(toEditorialMedia(asset)).toEqual({
      id: 'm1',
      url: '/api/v1/media/foo.jpg',
      title: 'Foo',
      alt: 'Foo alt',
      width: 100,
      height: 200,
    });
  });
});
