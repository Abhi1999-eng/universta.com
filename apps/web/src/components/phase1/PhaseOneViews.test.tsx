import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/* The hero renders a client component that reaches for the app router. The
 * composition is what these tests are about, so it is stubbed out. */
vi.mock('@/components/student/StudentCatalogueActions', () => ({
  StudentCatalogueActions: () => null,
}));

import { PhaseDetail, UniversityDetail, type AnyRecord } from './PhaseOneViews';

/**
 * The shared detail template rendered a fixed skeleton whatever the record
 * held: a hero card reading the resource's own name over "Published local
 * record", an "Overview" section repeating the hero lede, and one "nothing is
 * published" section per empty relation. A record with a deadline and no prose
 * became a page of empty bands.
 */

const render = (node: React.ReactElement) => renderToStaticMarkup(node);

const scholarship: AnyRecord = {
  id: 's1',
  title: 'International Excellence Scholarship',
  slug: 'international-excellence-scholarship',
  summary: 'Merit-based tuition support for high-achieving international students.',
  amount: '10000',
  currencyCode: 'GBP',
  benefitType: 'PARTIAL_TUITION',
  deadline: '2026-10-31T00:00:00.000Z',
};

describe('shared detail template', () => {
  it('never ships a card that only names the resource', () => {
    const html = render(<PhaseDetail resource="scholarships" row={scholarship} />);
    expect(html).not.toContain('Published local record');
    expect(html).not.toContain('hero-placeholder');
  });

  it('carries the facts the listing card already showed', () => {
    const html = render(<PhaseDetail resource="scholarships" row={scholarship} />);
    expect(html).toContain('GBP 10,000');
    expect(html).toContain('Partial tuition');
    expect(html).toContain('31 Oct 2026');
  });

  it('puts the facts beside the title when there is no prose to read', () => {
    const html = render(<PhaseDetail resource="scholarships" row={scholarship} />);
    // No two-column body with an empty main column.
    expect(html).not.toContain('detail-content');
    expect(html).toContain('detail-hero-panel');
    expect(html).not.toContain('What to know');
  });

  it('keeps the reading column when the record publishes prose', () => {
    const html = render(
      <PhaseDetail
        resource="scholarships"
        row={{ ...scholarship, overview: 'A longer published overview of the award.' }}
      />,
    );
    expect(html).toContain('detail-content');
    expect(html).toContain('What to know');
    expect(html).toContain('A longer published overview of the award.');
    expect(html).not.toContain('detail-hero-panel');
  });

  it('does not repeat the hero lede as the body copy', () => {
    const html = render(
      <PhaseDetail resource="scholarships" row={{ ...scholarship, overview: scholarship.summary }} />,
    );
    expect(html).not.toContain('What to know');
  });
});

describe('university detail', () => {
  const university: AnyRecord = {
    id: 'u1',
    name: 'Technical University of Munich',
    slug: 'technical-university-of-munich',
    shortDescription: 'A research-focused German university.',
    institutionType: 'PUBLIC',
    country: { name: 'Germany' },
    campuses: [{ id: 'c1', name: 'Main Campus', city: 'Munich', state: 'Bavaria' }],
    offerings: [
      {
        id: 'o1',
        name: 'MSc Mechanical Engineering',
        slug: 'msc-mechanical-engineering',
        genericCourse: { subject: { name: 'Engineering' } },
      },
    ],
  };

  it('says nothing where nothing is published', () => {
    const html = render(<UniversityDetail row={{ ...university, campuses: [], offerings: [] }} />);
    expect(html).not.toContain('No overview is published');
    expect(html).not.toContain('No campuses are published');
    expect(html).not.toContain('No offerings are published');
    // One honest line in place of three sections announcing their own absence.
    expect((html.match(/editorial-section/g) ?? []).length).toBe(1);
  });

  it('still explains a record that publishes only its name and country', () => {
    const html = render(
      <UniversityDetail row={{ id: 'u2', name: 'Bare University', slug: 'bare', country: { name: 'Germany' } }} />,
    );
    expect(html).toContain('published with its name and country only');
  });

  it('counts offerings once, in the facts panel', () => {
    const html = render(<UniversityDetail row={university} />);
    expect(html).toContain('Course offerings');
    expect((html.match(/Institution facts|INSTITUTION FACTS/gi) ?? []).length).toBe(1);
    expect(html).not.toContain('hero-card');
  });

  it('renders campuses and offerings with the same card', () => {
    const html = render(<UniversityDetail row={university} />);
    expect((html.match(/pd-grid pd-grid-cards/g) ?? []).length).toBe(2);
    expect(html).toContain('Munich, Bavaria');
    expect(html).toContain('/universities/technical-university-of-munich/courses/msc-mechanical-engineering');
  });
});
