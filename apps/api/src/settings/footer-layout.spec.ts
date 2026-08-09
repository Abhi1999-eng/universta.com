import { BadRequestException } from '@nestjs/common';
import { sanitizeFooterLayout, FOOTER_LAYOUT_VERSION } from './footer-layout';

/** The composed footer is admin-authored content that lands on every page of
 * the public site, so its links get the same scrutiny as the flat settings.
 * These pin the guards that make storing it safe. */
describe('sanitizeFooterLayout', () => {
  it('treats an absent layout as "keep the original fixed footer"', () => {
    expect(sanitizeFooterLayout(null)).toBeNull();
    expect(sanitizeFooterLayout(undefined)).toBeNull();
  });

  it('accepts a document with no rows yet', () => {
    expect(sanitizeFooterLayout({})).toEqual({
      version: FOOTER_LAYOUT_VERSION,
      rows: [],
    });
  });

  it('keeps a valid row and its blocks', () => {
    const result = sanitizeFooterLayout({
      rows: [
        {
          id: 'row-1',
          layout: 'three-columns',
          blocks: [
            { id: 'b1', type: 'HEADING', heading: 'Study Abroad', area: 0 },
            {
              id: 'b2',
              type: 'LINK_LIST',
              area: 1,
              links: [{ label: 'Countries', url: '/countries' }],
            },
          ],
        },
      ],
    });
    expect(result?.rows).toHaveLength(1);
    expect(result?.rows[0].blocks[1].links?.[0]).toEqual({
      label: 'Countries',
      url: '/countries',
      newTab: false,
    });
  });

  /** The same open-redirect shape the flat settings block: a protocol-relative
   * URL keeps the current scheme but sends visitors to another host. */
  it('rejects an unsafe link URL', () => {
    expect(() =>
      sanitizeFooterLayout({
        rows: [
          {
            layout: 'one-column',
            blocks: [
              {
                type: 'LINK_LIST',
                links: [{ label: 'Bad', url: '//evil.example.com' }],
              },
            ],
          },
        ],
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects an unsafe button URL', () => {
    expect(() =>
      sanitizeFooterLayout({
        rows: [
          {
            layout: 'one-column',
            blocks: [{ type: 'CTA', ctaUrl: 'javascript:alert(1)' }],
          },
        ],
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects unknown layouts and block types rather than storing them', () => {
    expect(() =>
      sanitizeFooterLayout({ rows: [{ layout: 'seven-columns', blocks: [] }] }),
    ).toThrow(BadRequestException);
    expect(() =>
      sanitizeFooterLayout({
        rows: [{ layout: 'one-column', blocks: [{ type: 'IFRAME' }] }],
      }),
    ).toThrow(BadRequestException);
  });

  /** Narrowing a row's layout must not silently lose a block that sat in a
   * column the new layout no longer has. */
  it('clamps a block into the last available area instead of dropping it', () => {
    const result = sanitizeFooterLayout({
      rows: [
        {
          layout: 'two-equal',
          blocks: [{ type: 'TEXT', text: 'Kept', area: 3 }],
        },
      ],
    });
    expect(result?.rows[0].blocks).toHaveLength(1);
    expect(result?.rows[0].blocks[0].area).toBe(1);
  });

  it('caps rows, blocks and links so one document cannot grow unbounded', () => {
    const row = { layout: 'one-column', blocks: [] };
    expect(() =>
      sanitizeFooterLayout({ rows: Array.from({ length: 13 }, () => row) }),
    ).toThrow(BadRequestException);
    expect(() =>
      sanitizeFooterLayout({
        rows: [
          {
            layout: 'one-column',
            blocks: [
              {
                type: 'LINK_LIST',
                links: Array.from({ length: 21 }, () => ({
                  label: 'x',
                  url: '/x',
                })),
              },
            ],
          },
        ],
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects over-long admin text rather than truncating it silently', () => {
    expect(() =>
      sanitizeFooterLayout({
        rows: [
          {
            layout: 'one-column',
            blocks: [{ type: 'TEXT', text: 'x'.repeat(2001) }],
          },
        ],
      }),
    ).toThrow(BadRequestException);
  });

  it('defaults rows and blocks to visible', () => {
    const result = sanitizeFooterLayout({
      rows: [{ layout: 'one-column', blocks: [{ type: 'DIVIDER' }] }],
    });
    expect(result?.rows[0].visible).toBe(true);
    expect(result?.rows[0].blocks[0].visible).toBe(true);
  });

  it('honours an explicit hide', () => {
    const result = sanitizeFooterLayout({
      rows: [
        {
          layout: 'one-column',
          visible: false,
          blocks: [{ type: 'DIVIDER', visible: false }],
        },
      ],
    });
    expect(result?.rows[0].visible).toBe(false);
    expect(result?.rows[0].blocks[0].visible).toBe(false);
  });
});
