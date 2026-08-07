import { describe, expect, it } from 'vitest';
import {
  titleFromFilename,
  toEditorialMedia,
  validateMediaFile,
} from './media-upload';

function fakeFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('validateMediaFile', () => {
  it('accepts a JPEG under the size cap', () => {
    expect(validateMediaFile(fakeFile('campus.jpg', 'image/jpeg', 1024))).toBeNull();
  });

  it('rejects an unsupported type', () => {
    expect(validateMediaFile(fakeFile('logo.svg', 'image/svg+xml', 1024))).toMatch(
      /unsupported/i,
    );
  });

  it('rejects a file over 5MB', () => {
    expect(
      validateMediaFile(
        fakeFile('huge.png', 'image/png', 5 * 1024 * 1024 + 1),
      ),
    ).toMatch(/5MB/);
  });

  it('accepts a file exactly at the 5MB cap', () => {
    expect(
      validateMediaFile(
        fakeFile('exact.png', 'image/png', 5 * 1024 * 1024),
      ),
    ).toBeNull();
  });
});

describe('titleFromFilename', () => {
  it('turns dashes and underscores into a readable title', () => {
    expect(titleFromFilename('westbridge-campus_photo.jpg')).toBe(
      'Westbridge campus photo',
    );
  });
});

describe('toEditorialMedia', () => {
  it('maps Media Library assets to the picker shape and same-origin URL', () => {
    expect(
      toEditorialMedia({
        id: 'm1',
        publicUrl: '/media/foo.jpg',
        title: 'Foo',
        altText: 'Foo alt',
        width: 100,
        height: 200,
        originalFileName: 'foo.jpg',
      }),
    ).toEqual({
      id: 'm1',
      url: '/api/v1/media/foo.jpg',
      title: 'Foo',
      alt: 'Foo alt',
      width: 100,
      height: 200,
    });
  });
});
