import { describe, expect, it } from 'vitest';
import { countryTabs } from './CountryTabs';

/**
 * A destination is four pages, and until this strip existed the guide linked
 * down into its own sections and nowhere across them.
 */
const labels = (counts: {
  subjects: number;
  universities: number;
  scholarships: number;
}) => countryTabs('united-kingdom', counts).map((tab) => tab.key);

describe('a destination’s tab strip', () => {
  it('offers all four when all four have something', () => {
    expect(labels({ subjects: 30, universities: 100, scholarships: 61 })).toEqual([
      'overview',
      'subjects',
      'universities',
      'scholarships',
    ]);
  });

  it('leaves out a tab with nothing behind it', () => {
    // "Universities 0" is a dead end dressed as an invitation.
    expect(labels({ subjects: 30, universities: 0, scholarships: 61 })).toEqual([
      'overview',
      'subjects',
      'scholarships',
    ]);
  });

  it('keeps Overview even when it is the only one', () => {
    expect(labels({ subjects: 0, universities: 0, scholarships: 0 })).toEqual([
      'overview',
    ]);
  });

  it('points each tab at the destination’s own path', () => {
    const tabs = countryTabs('united-kingdom', {
      subjects: 1,
      universities: 1,
      scholarships: 1,
    });
    const href = (key: string) => tabs.find((tab) => tab.key === key)?.href;
    expect(href('overview')).toBe('/study-abroad/united-kingdom');
    expect(href('subjects')).toBe('/study-abroad/united-kingdom/subjects');
    expect(href('universities')).toBe('/study-abroad/united-kingdom/universities');
  });

  /* Under the destination, as the behaviour reference files it: the tab
     used to leave for the worldwide finder, which never named the country
     and had no strip to come back by. */
  it('keeps scholarships under the destination', () => {
    const tabs = countryTabs('united-kingdom', {
      subjects: 1,
      universities: 1,
      scholarships: 61,
    });
    expect(tabs.find((tab) => tab.key === 'scholarships')?.href).toBe(
      '/study-abroad/united-kingdom/scholarships',
    );
  });

  it('carries the count on everything but the guide', () => {
    const tabs = countryTabs('germany', {
      subjects: 35,
      universities: 15,
      scholarships: 2,
    });
    expect(tabs.map((tab) => tab.count)).toEqual([null, 35, 15, 2]);
  });
});
