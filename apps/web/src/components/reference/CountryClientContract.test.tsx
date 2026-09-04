import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CountryDetailReference,
  type CountryDetailReferenceProps,
} from './CountryDetailReference';

/**
 * The client's Country contract, checked at the surface a reader actually
 * sees. The one that matters most is Subjects: the page must show what an
 * editor assigned on the Country record, not what the course catalogue happens
 * to imply, because those two answers diverge the moment a country is
 * published before its courses are.
 */

const VERIFIED = {
  sourceReference: 'https://example.invalid/source',
  verifiedAt: '2026-01-01T00:00:00.000Z',
};

function section(sectionKey: string, heading: string, paragraph: string) {
  return {
    id: `section-${sectionKey}`,
    sectionKey,
    sectionType: 'RICH_TEXT',
    eyebrow: null,
    heading,
    subheading: null,
    bodyJson: { paragraphs: [paragraph] },
    primaryMedia: null,
    secondaryMedia: null,
    ctaLabel: null,
    ctaUrl: null,
    configurationJson: null,
    displayOrder: 0,
    status: 'ACTIVE',
  };
}

function build(
  overrides: Partial<{
    country: Record<string, unknown>;
    profiles: Record<string, unknown>;
    sections: unknown[];
    faqs: unknown[];
    subjects: Array<{ id: string; name: string; slug: string }>;
    universities: unknown[];
    scholarships: unknown[];
    cities: unknown[];
  }> = {},
): CountryDetailReferenceProps {
  return {
    page: {
      country: {
        id: 'c1',
        name: 'Australia',
        slug: 'australia',
        pageHeading: 'Study in Australia',
        shortDescription: 'Explore universities across Australia.',
        tagline: 'Where research meets the coast',
        overview: 'A longer published overview.',
        capitalCity: 'Canberra',
        officialLanguage: 'English',
        currency: { code: 'AUD', symbol: '$' },
        continent: { id: 'e1', name: 'Oceania', slug: 'oceania' },
        flag: null,
        listingImage: null,
        heroImage: null,
        featured: false,
        displayOrder: 0,
        subjects: [
          { id: 's1', name: 'Engineering', slug: 'engineering' },
          { id: 's2', name: 'Nursing', slug: 'nursing' },
        ],
        ...overrides.country,
      },
      profiles: {
        cost: {
          ...VERIFIED,
          currencyCode: 'AUD',
          tuitionMin: '20000',
          tuitionMax: '30000',
          tuitionPeriod: 'PER_YEAR',
          livingCostMin: '1200',
          livingCostMax: '1800',
          livingCostPeriod: 'PER_MONTH',
          applicationFeeMin: '75',
          applicationFeeMax: '75',
        },
        work: {
          ...VERIFIED,
          visaType: 'Student visa (subclass 500)',
          visaFee: '710',
          visaFeeCurrencyCode: 'AUD',
          visaProcessingTime: '4 to 8 weeks',
          partTimeAllowed: true,
          partTimeHoursPerWeek: '24',
          postStudyWorkAvailable: true,
          postStudyWorkMaxMonths: 36,
          visaInformation: '<p>Apply after the offer is accepted.</p>',
        },
        language: {
          ...VERIFIED,
          ieltsRequirement: 'REQUIRED',
          ieltsMinScore: '6.5',
          toeflRequirement: 'OPTIONAL',
          toeflMinScore: '79',
          pteRequirement: 'OPTIONAL',
          pteMinScore: '58',
          duolingoRequirement: 'VARIES',
          duolingoMinScore: '110',
        },
        statistics: null,
        intakes: [
          {
            intake: { id: 'i1', name: 'February', slug: 'february', startMonth: 2, endMonth: 2 },
            isMajor: true,
            availabilityStatus: 'AVAILABLE',
            applicationOpeningMonth: 9,
            applicationDeadlineMonth: 12,
            notes: 'Main intake.',
            displayOrder: 0,
          },
        ],
        ...overrides.profiles,
      },
      sections: overrides.sections ?? [
        section('why-study', 'Why study in Australia', 'English-taught degrees and a large research sector.'),
        // The keys the Country editor can actually produce.
        section('application-steps', 'Admission process', 'Apply directly to the institution.'),
        section('cost-of-study', 'Cost breakdown', 'Tuition is published per year.'),
        section('visa-process', 'Visa process', 'The student visa is applied for online.'),
      ],
      faqs: overrides.faqs ?? [
        { id: 'f1', question: 'Can I work while studying?', answer: 'Yes, within the permitted hours.', category: null, isFeatured: false, displayOrder: 0 },
      ],
      seo: null,
      consultantCards: [],
    },
    cities: overrides.cities ?? [
      { id: 'city1', name: 'Sydney', slug: 'sydney', shortDescription: 'Harbour city.' },
    ],
    universities: overrides.universities ?? [
      { id: 'u1', name: 'Coastal University', slug: 'coastal-university', institutionType: 'PUBLIC' },
    ],
    universityTotal: 1,
    scholarships: overrides.scholarships ?? [
      { title: 'Coastal Award', slug: 'coastal-award', summary: 'Merit award.', amount: 'AUD 5,000', level: null, deadline: null },
    ],
    scholarshipTotal: 1,
    subjects:
      overrides.subjects ??
      ([
        { id: 's1', name: 'Engineering', slug: 'engineering' },
        { id: 's2', name: 'Nursing', slug: 'nursing' },
      ] as never),
    courseTotal: 12,
  } as unknown as CountryDetailReferenceProps;
}

const render = (props: CountryDetailReferenceProps) =>
  renderToStaticMarkup(<CountryDetailReference {...props} />);

describe('country detail — client contract', () => {
  const html = render(build());

  it('renders the authored subjects section with links to each subject page', () => {
    expect(html).toContain('Subjects in Australia');
    expect(html).toContain('href="/subjects/engineering"');
    expect(html).toContain('href="/subjects/nursing"');
    expect(html).toContain('directly assigned');
  });

  it('keeps the assigned order and renders each subject once', () => {
    const engineering = html.indexOf('/subjects/engineering');
    const nursing = html.indexOf('/subjects/nursing');
    expect(engineering).toBeGreaterThan(-1);
    expect(engineering).toBeLessThan(nursing);
    expect(html.match(/href="\/subjects\/engineering"/g) ?? []).toHaveLength(1);
  });

  it('omits the subjects section entirely when nothing is assigned', () => {
    // Course-derived subjects must not be substituted to fill the gap.
    const empty = render(build({ subjects: [] }));
    expect(empty).not.toContain('Subjects in Australia');
    expect(empty).not.toContain('id="subjects"');
  });

  it('renders the hero identity: heading, tagline and excerpt', () => {
    expect(html).toContain('Study in Australia');
    expect(html).toContain('Where research meets the coast');
    expect(html).toContain('Explore universities across Australia.');
  });

  it('keeps the short excerpt plain text when pasted markup is supplied', () => {
    const hero = render(
      build({ country: { shortDescription: '<p>Hello <strong>students</strong></p><script>alert(1)</script>' } }),
    );
    expect(hero).toContain('Hello students');
    expect(hero).not.toContain('&lt;p&gt;');
    expect(hero).not.toContain('alert(1)');
  });

  it('omits an empty work and visa section rather than rendering only its disclaimer', () => {
    const html = render(build({ profiles: { work: {} } }));
    expect(html).not.toContain('id="visa"');
    expect(html).not.toContain('Immigration rules change frequently');
  });

  it('shows the living-cost note alongside the tuition note, not instead of it', () => {
    const html = render(
      build({
        profiles: {
          cost: {
            currencyCode: 'EUR',
            tuitionMin: '1000',
            tuitionMax: '2000',
            tuitionNotes: 'Tuition note text',
            livingCostMin: '100',
            livingCostMax: '200',
            livingCostNotes: 'Living note text',
          },
        },
      }),
    );
    // `??` between them meant the living note was unreachable whenever a
    // tuition note existed, which is the common case.
    expect(html).toContain('Tuition note text');
    expect(html).toContain('Living note text');
  });

  it('falls back to initials rather than a broken image when no flag exists', () => {
    expect(html).not.toContain('<img src=""');
    expect(html).toContain('AU');
  });

  it('renders capital, official language and currency', () => {
    expect(html).toContain('Canberra');
    expect(html).toContain('Capital');
    expect(html).toContain('English');
    expect(html).toContain('AUD ($)');
  });

  it('renders tuition, living costs and the application fee', () => {
    expect(html).toContain('Tuition');
    expect(html).toContain('20,000');
    expect(html).toContain('Living costs');
    expect(html).toContain('Application fee');
    // min equals max, so one value rather than a range
    expect(html).toContain('75');
    expect(html).not.toContain('75 – 75');
  });

  it('renders a range when the minimum and maximum differ', () => {
    expect(html).toMatch(/20,000\s*[–-]\s*30,000/);
  });

  it('renders visa type, fee, processing time and work rights', () => {
    expect(html).toContain('Visa type');
    expect(html).toContain('Student visa (subclass 500)');
    expect(html).toContain('Visa fee');
    expect(html).toContain('AUD 710');
    expect(html).toContain('4 to 8 weeks');
    expect(html).toContain('24 hours a week');
    // Months are humanised into years rather than shown as a raw 36.
    expect(html).toContain('3 years');
  });

  it('renders rich visa information as safe content, while preserving plain text', () => {
    const rich = render(build());
    expect(rich).toContain('<p>Apply after the offer is accepted.</p>');
    expect(rich).not.toContain('&lt;p&gt;Apply after the offer is accepted.');

    const plain = render(
      build({ profiles: { work: { ...VERIFIED, visaInformation: 'Apply online.' } } }),
    );
    expect(plain).toContain('Apply online.');
    expect(plain).toContain('white-space:pre-line');
  });

  it('sanitizes unsafe visa information through the shared rich text renderer', () => {
    const html = render(
      build({
        profiles: {
          work: {
            ...VERIFIED,
            visaInformation:
              '<p>Safe guidance.</p><script>alert(1)</script><a href="javascript:bad()">Bad</a>',
          },
        },
      }),
    );
    expect(html).toContain('Safe guidance.');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
    expect(html).not.toContain('javascript:');
  });

  it('humanises stored enums rather than showing raw values', () => {
    expect(html).not.toContain('NOT_PUBLISHED');
    expect(html).not.toContain('PER_YEAR');
  });

  it('keeps the full English requirement table, not IELTS alone', () => {
    expect(html).toContain('IELTS');
    expect(html).toContain('6.5');
    expect(html).toContain('TOEFL');
    expect(html).toContain('PTE');
    expect(html).toContain('Duolingo');
  });

  it('renders canonical intake records', () => {
    expect(html).toContain('February');
    expect(html).toContain('Main intake.');
  });

  /** Just the overview section's markup. Other blocks render their own
   * content, and this change is only about this one. */
  const overviewHtml = (html: string) => {
    const start = html.indexOf('id="overview"');
    if (start === -1) return '';
    return html.slice(start, html.indexOf('<section', start + 1));
  };

  it('renders Country.overview as the country content', () => {
    const html = render(
      build({ country: { overview: 'The client supplied this overview.' } }),
    );
    expect(html).toContain('The client supplied this overview.');
  });

  it('renders a plain-text overview, keeping its line breaks', () => {
    const block = overviewHtml(
      render(build({ country: { overview: 'First para.\n\nSecond para.' } })),
    );
    expect(block).toContain('First para.');
    expect(block).toContain('Second para.');
    // The plain-text branch preserves the author's own breaks.
    expect(block).toContain('pre-line');
  });

  /**
   * Production rendered `<p>...</p>` from Country.overview as visible markup:
   * the column holds rich text, and it was being printed as escaped text. It
   * goes through the same RichText renderer the long-form sections use.
   */
  it('renders an HTML overview as content, not as visible markup', () => {
    const block = overviewHtml(
      render(build({ country: { overview: '<p>Study in Poland</p>' } })),
    );
    expect(block).toContain('<p>Study in Poland</p>');
    // The literal tags must not reach the reader.
    expect(block).not.toContain('&lt;p&gt;');
    expect(block).not.toContain('&lt;/p&gt;');
  });

  it('keeps the formatting an editor applied', () => {
    const block = overviewHtml(
      render(
        build({
          country: {
            overview:
              '<p><strong>Bold</strong> and <em>italic</em>.</p>' +
              '<ul><li>First point</li><li>Second point</li></ul>' +
              '<p><a href="https://example.com/guide">Read the guide</a></p>',
          },
        }),
      ),
    );
    expect(block).toContain('<strong>Bold</strong>');
    expect(block).toContain('<em>italic</em>');
    expect(block).toContain('<ul><li>First point</li><li>Second point</li></ul>');
    expect(block).toContain('href="https://example.com/guide"');
    expect(block).toContain('rel="noopener noreferrer"');
  });

  it('treats unsafe overview content exactly as it treats any other rich text', () => {
    const overview =
      '<p>Safe copy.</p><script>alert(1)</script>' +
      '<p onclick="steal()">Attribute dropped.</p>' +
      '<a href="javascript:alert(1)">Bad link</a>';
    const block = overviewHtml(render(build({ country: { overview } })));
    // Same guarantees the shared renderer already gives the long-form sections.
    expect(block).toContain('Safe copy.');
    expect(block).not.toContain('<script');
    expect(block).not.toContain('alert(1)');
    expect(block).not.toContain('onclick');
    expect(block).not.toContain('javascript:');
  });

  it('renders the overview exactly once', () => {
    const html = render(
      build({ country: { overview: '<p>Only once.</p>' } }),
    );
    expect(html.split('Only once.').length - 1).toBe(1);
    expect(html.split('id="overview"').length - 1).toBe(1);
  });

  it('leaves the long-form client sections rendering as they were', () => {
    const html = render(build({ country: { overview: '<p>An overview.</p>' } }));
    // Still the same four sections, still through RichText.
    for (const heading of [
      'Why study in Australia',
      'Admission process',
      'Cost breakdown',
      'Visa process',
    ])
      expect(html).toContain(heading);
    expect(html).toContain('English-taught degrees and a large research sector.');
  });

  it('falls back to a legacy overview section only when the column is empty', () => {
    // The legacy block carried its body in `subheading`, not in bodyJson.
    const legacy = {
      ...section('overview', 'About Australia', ''),
      subheading: 'Legacy body.',
    };
    const withColumn = render(
      build({
        country: { overview: 'Canonical body.' },
        sections: [legacy],
      }),
    );
    expect(withColumn).toContain('Canonical body.');
    // One overview, not two.
    expect(withColumn).not.toContain('Legacy body.');

    const withoutColumn = render(
      build({ country: { overview: null }, sections: [legacy] }),
    );
    expect(withoutColumn).toContain('Legacy body.');
  });

  it('renders the hero image when the country has one', () => {
    const html = render(
      build({
        country: {
          heroImage: { url: '/api/v1/media/hero.png', alt: 'Sydney harbour' },
        },
      }),
    );
    expect(html).toContain('hero-media');
    expect(html).toContain('/api/v1/media/hero.png');
    expect(html).toContain('Sydney harbour');
  });

  it('omits the hero figure entirely when there is no hero image', () => {
    expect(render(build())).not.toContain('hero-media');
  });

  it('keeps the flag rendering and its empty alt when a hero is also present', () => {
    const html = render(
      build({
        country: {
          flag: { url: '/api/v1/media/flag.png', alt: 'Flag of Australia' },
          heroImage: { url: '/api/v1/media/hero.png', alt: 'Sydney harbour' },
        },
      }),
    );
    expect(html).toContain('/api/v1/media/flag.png');
    // The flag chip stays decorative; the hero carries the real alt text.
    expect(html).toContain('alt=""');
    expect(html).toContain('Sydney harbour');
  });

  it('renders all four long-form client sections', () => {
    expect(html).toContain('Why study in Australia');
    expect(html).toContain('English-taught degrees and a large research sector.');
    expect(html).toContain('Admission process');
    expect(html).toContain('Apply directly to the institution.');
    expect(html).toContain('Cost breakdown');
    expect(html).toContain('Tuition is published per year.');
    expect(html).toContain('Visa process');
    expect(html).toContain('The student visa is applied for online.');
  });

  it('does not render a long-form section that has no body', () => {
    const blank = render(
      build({
        sections: [
          {
            ...section('why-study', 'Why study in Australia', ''),
            bodyJson: { paragraphs: [] },
          },
        ],
      }),
    );
    expect(blank).not.toContain('id="country-why-study"');
  });

  it('renders FAQ rich text once without literal markup and preserves the accordion', () => {
    const faqHtml = render(
      build({
        faqs: [
          {
            id: 'f1',
            question: 'Can I work while studying?',
            answer: '<p>Yes, within the <strong>permitted hours</strong>.</p>',
            category: null,
            isFeatured: false,
            displayOrder: 0,
          },
        ],
      }),
    );
    expect(faqHtml).toContain('<details class="qa"');
    expect(faqHtml).toContain('<strong>permitted hours</strong>');
    expect(faqHtml).not.toContain('&lt;p&gt;Yes, within');
    expect(faqHtml.split('permitted hours').length - 1).toBe(1);
  });

  it('keeps plain-text FAQ answers working', () => {
    expect(html).toContain('Can I work while studying?');
    expect(html).toContain('Yes, within the permitted hours.');
  });

  it('preserves the existing catalogue sections', () => {
    expect(html).toContain('Coastal University');
    expect(html).toContain('Coastal Award');
    expect(html).toContain('Sydney');
    expect(html).toContain('counselling');
  });

  it('keeps one h1 and no empty section landmark', () => {
    expect(html.match(/<h1/g) ?? []).toHaveLength(1);
    // A section that renders its heading must have rendered content with it.
    expect(html).not.toMatch(/<section[^>]*id="subjects"[^>]*>\s*<\/section>/);
  });

  it('does not leak admin-only identity onto the public page', () => {
    const withUid = render(
      build({ country: { externalUid: 'client-uid-001' } }),
    );
    expect(withUid).not.toContain('client-uid-001');
  });

  it('does not render country tags publicly in this slice', () => {
    const withTags = render(
      build({ country: { tags: [{ id: 't1', name: 'PopularTag', slug: 'popular' }] } }),
    );
    expect(withTags).not.toContain('PopularTag');
  });
});
