import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConsultantDetailReference, type ConsultantDetailProps } from './ConsultantDetailReference';

/**
 * The profile used to give services, destinations, languages and offices a
 * full-width band each -- an eyebrow, a 38px heading and one chip, roughly
 * 250px of page per word -- and filled the panel beside the title with a table
 * counting those same chips. These tests hold the composition that replaced it.
 */

function build(over: Partial<ConsultantDetailProps> = {}): ConsultantDetailProps {
  return {
    consultant: {
      name: 'Horizon Study Abroad',
      slug: 'horizon-study-abroad',
      shortDescription: 'Guidance for UK and Canadian postgraduate applications.',
      description: null,
      email: 'hello@horizon.example',
      phone: '+15550000001',
      websiteUrl: null,
      verified: true,
      verifiedAt: null,
      sourceReference: null,
    },
    countries: [{ name: 'Canada', slug: 'canada' }],
    services: ['Application review'],
    languages: ['English'],
    locations: [
      {
        name: 'Horizon London Office',
        slug: 'horizon-london-office',
        city: 'London',
        state: 'England',
        country: 'United Kingdom',
        address: null,
      },
    ],
    ...over,
  };
}

const render = (props: ConsultantDetailProps) =>
  renderToStaticMarkup(<ConsultantDetailReference {...props} />);

describe('consultant profile composition', () => {
  it('groups every attribute into one content-sized section', () => {
    const html = render(build());
    // One profile section, not one band per attribute.
    expect((html.match(/class="sec cdetail-sec"/g) ?? []).length).toBe(1);
    expect(html).toContain('pd-defrow');
    // The old bands each carried their own eyebrow.
    expect(html).not.toContain('Where they help');
    expect(html).not.toContain('Where to find them');
  });

  it('shows contact details rather than a count of the chips below', () => {
    const html = render(build());
    expect(html).toContain('mailto:hello@horizon.example');
    expect(html).toContain('tel:+15550000001');
    expect(html).not.toContain('Profile at a glance');
    expect(html).not.toContain('Every figure below is a published field');
  });

  it('offers counselling when the consultant published no way to reach them', () => {
    const html = render(
      build({
        consultant: { ...build().consultant, email: null, phone: null, websiteUrl: null },
      }),
    );
    expect(html).toContain('has not published contact details');
    expect(html).toContain('href="/counselling"');
    expect(html).not.toContain('mailto:');
  });

  it('drops the coverage card when only an office is published', () => {
    const html = render(build({ services: [], countries: [], languages: [] }));
    expect(html).not.toContain('Coverage');
    expect(html).toContain('Horizon London Office');
    // The place still reads as a place, not just a name.
    expect(html).toContain('London, England, United Kingdom');
  });

  it('renders no profile section at all when nothing is published', () => {
    const html = render(build({ services: [], countries: [], languages: [], locations: [] }));
    expect(html).not.toContain('What this consultant covers');
    expect(html).not.toContain('pd-grid');
  });

  it('states verification as a badge instead of grey small print', () => {
    expect(render(build())).toContain('pd-badge is-verified');
    expect(render(build({ consultant: { ...build().consultant, verified: false } }))).toContain(
      'Not yet verified',
    );
  });
});
