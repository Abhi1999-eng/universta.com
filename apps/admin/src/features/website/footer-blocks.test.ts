import { describe, expect, it } from 'vitest';
import {
  FOOTER_BLOCKS,
  ROW_LAYOUTS,
  footerBlockLabel,
  layoutAreas,
  newBlock,
  newRow,
  reflowRow,
} from './footer-blocks';

/** The footer block library is what an admin picks from, so it must stay in
 * step with what ComposedFooter can render and must never show a raw type. */
describe('footer block registry', () => {
  /** Kept in step with the switch in
   * apps/web/src/components/chrome/ComposedFooter.tsx. */
  const RENDERED = new Set([
    'BRAND',
    'HEADING',
    'TEXT',
    'NAV_LINKS',
    'LINK_LIST',
    'CTA',
    'CONTACT',
    'SOCIAL',
    'LEGAL_LINKS',
    'COPYRIGHT',
    'DIVIDER',
    'DISCLAIMER',
  ]);

  it('only offers blocks the public footer can render', () => {
    for (const block of FOOTER_BLOCKS)
      expect(RENDERED.has(block.type)).toBe(true);
  });

  it('never shows a raw type name to the admin', () => {
    for (const block of FOOTER_BLOCKS) {
      expect(block.label).not.toMatch(/_/);
      expect(block.label).not.toEqual(block.type);
    }
  });

  it('describes every approved row layout in plain language', () => {
    for (const layout of ROW_LAYOUTS) {
      // A hyphen inside a word ("full-width") is fine; showing the stored
      // kebab-case value ("one-column") is not.
      expect(layout.label).not.toEqual(layout.value);
      expect(layout.label).toMatch(/^[A-Z]/);
      expect(layout.areas).toBeGreaterThan(0);
    }
  });

  it('starts a new block with the fields its type actually uses', () => {
    const links = newBlock('LINK_LIST');
    expect(links.links).toEqual([]);
    expect(links.ctaLabel).toBeUndefined();

    const cta = newBlock('CTA');
    expect(cta.ctaUrl).toBe('');
    expect(cta.links).toBeUndefined();

    // A divider carries no content at all.
    const divider = newBlock('DIVIDER');
    expect(divider.text).toBeUndefined();
    expect(divider.links).toBeUndefined();
  });

  it('makes new rows and blocks visible by default', () => {
    expect(newRow().visible).toBe(true);
    expect(newBlock('TEXT').visible).toBe(true);
  });

  it('gives every row and block a unique id', () => {
    const ids = [newRow().id, newRow().id, newBlock('TEXT').id, newBlock('TEXT').id];
    expect(new Set(ids).size).toBe(4);
  });

  /** Narrowing a four-column row to two must not strand a block in a column
   * that no longer exists -- the API clamps on save, so the editor has to
   * show the same thing. */
  it('moves blocks into the last column when the layout narrows', () => {
    const row = {
      ...newRow('four-columns'),
      blocks: [
        { ...newBlock('TEXT'), area: 3 },
        { ...newBlock('TEXT'), area: 1 },
      ],
    };
    const narrowed = reflowRow(row, 'two-equal');
    expect(narrowed.blocks.map((block) => block.area)).toEqual([1, 1]);
    expect(narrowed.blocks).toHaveLength(2);
  });

  it('agrees with the layout list about how many columns each shape has', () => {
    expect(layoutAreas('one-column')).toBe(1);
    expect(layoutAreas('four-columns')).toBe(4);
    expect(layoutAreas('brand-plus-three')).toBe(4);
  });

  it('falls back to a usable definition for an unknown block', () => {
    expect(footerBlockLabel('MYSTERY' as never)).toBe('MYSTERY');
  });
});
