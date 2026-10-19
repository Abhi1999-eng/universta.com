import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UniversityTabs } from './UniversityTabs';

const tabs = [
  { id: 'about', label: 'About' },
  { id: 'services', label: 'Services' },
];

describe('the section strip', () => {
  it('is named for a university unless the page says otherwise', () => {
    expect(renderToStaticMarkup(<UniversityTabs tabs={tabs} />)).toContain('aria-label="University sections"');
    expect(renderToStaticMarkup(<UniversityTabs tabs={tabs} label="Consultant sections" />)).toContain(
      'aria-label="Consultant sections"',
    );
  });

  it('stands down with fewer than two sections', () => {
    expect(renderToStaticMarkup(<UniversityTabs tabs={tabs.slice(0, 1)} />)).toBe('');
  });
});
