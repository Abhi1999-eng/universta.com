import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CountryEditorialSections } from './CountryEditorialSections';

describe('CountryEditorialSections', () => {
  it('resolves only the current country scoped variables in editorial content', () => {
    const html = renderToStaticMarkup(
      <CountryEditorialSections
        variables={{ countryName: 'Canada', countrySlug: 'canada' }}
        sections={[
          {
            id: 'section-1', sectionKey: 'why-study', sectionType: 'RICH_TEXT',
            eyebrow: null, heading: 'Study in {countryName}', subheading: null,
            bodyJson: { paragraphs: ['Explore {countryName} at /countries/{countrySlug}.'] },
            primaryMedia: null, secondaryMedia: null, ctaLabel: null, ctaUrl: null,
            configurationJson: null, displayOrder: 0, status: 'ACTIVE',
            createdAt: '', updatedAt: '',
          },
        ]}
      />,
    );
    expect(html).toContain('Study in Canada');
    expect(html).toContain('Explore Canada at /countries/canada.');
    expect(html).not.toContain('{countryName}');
    expect(html).not.toContain('{countrySlug}');
  });
});
