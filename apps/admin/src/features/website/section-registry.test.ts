import { describe, expect, it } from 'vitest';
import {
  ADDABLE_SECTION_TYPES,
  SECTION_DEFINITIONS,
  sectionDefinition,
  sectionLabel,
  sectionLibrary,
} from './section-registry';

/** The registry's job is to stop the editor offering sections the public site
 * cannot render. These lock that contract down, because the failure mode is
 * silent: an unrenderable type still saves, and only shows up as a bare line
 * of text on the live page. */
describe('section registry', () => {
  /** Kept in step with the type checks in
   * apps/web/src/components/phase1/PageSectionRenderer.tsx. If a type is added
   * there, add it here; if one is offered without a renderer, this fails. */
  const RENDERED_BY_PUBLIC_SITE = new Set([
    'RICH_TEXT',
    'CTA',
    'IMAGE',
    'IMAGE_TEXT',
    'CARD_GRID',
    'FAQ_GROUP',
    'STATS',
    'RELATED_LINKS',
    'LEAD_GENERATION',
    'COUNTRY_DIRECTORY',
    'UNIVERSITY_DIRECTORY',
    'COURSE_DIRECTORY',
    'SCHOLARSHIP_DIRECTORY',
    'CONSULTANT_DIRECTORY',
    'TESTIMONIALS',
    'SUCCESS_STORIES',
  ]);

  it('only offers sections the public site actually renders', () => {
    for (const type of ADDABLE_SECTION_TYPES)
      expect(RENDERED_BY_PUBLIC_SITE.has(type)).toBe(true);
  });

  it('does not offer the types that render as bare text', () => {
    expect(ADDABLE_SECTION_TYPES).not.toContain('HERO');
    expect(ADDABLE_SECTION_TYPES).not.toContain('CUSTOM');
  });

  it('still describes a stored legacy section so its panel is not empty', () => {
    expect(sectionDefinition('HERO').supportsCta).toBe(true);
    expect(sectionLabel('CUSTOM')).toBe('Custom');
  });

  it('falls back to a usable definition for an unknown type', () => {
    const definition = sectionDefinition('SOMETHING_UNSEEDED');
    expect(definition.supportsSupportingText).toBe(true);
    expect(definition.label).toBe('SOMETHING_UNSEEDED');
  });

  it('never shows a raw type name as a label', () => {
    for (const definition of SECTION_DEFINITIONS) {
      expect(definition.label).not.toMatch(/_/);
      expect(definition.label).not.toEqual(definition.type);
      expect(definition.description.length).toBeGreaterThan(0);
    }
  });

  it('gives every catalogue-backed section a default count to show', () => {
    for (const definition of SECTION_DEFINITIONS)
      if (definition.supportsData)
        expect(definition.defaults?.limit).toBeGreaterThan(0);
  });

  it('groups every offered section into the library exactly once', () => {
    const listed = sectionLibrary().flatMap((group) =>
      group.items.map((item) => item.type),
    );
    expect([...listed].sort()).toEqual([...ADDABLE_SECTION_TYPES].sort());
  });
});
