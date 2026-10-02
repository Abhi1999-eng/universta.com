import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { toScholarshipCards } from '@/lib/scholarship-card';
import { ScholarshipCards } from './ScholarshipCards';

const rows = [
  {
    id: 'sch-1',
    title: 'Global Excellence Award',
    slug: 'global-excellence',
    summary: 'For high-achieving international applicants.',
    benefitType: 'PARTIAL_TUITION',
    amount: '7500.00',
    currencyCode: 'EUR',
    deadline: '2027-03-31',
    eligibility: '<p>Minimum 70% in the qualifying degree.</p>',
    provider: { name: 'Ministry of Education' },
    countries: [{ country: { name: 'Germany', slug: 'germany', iso2Code: 'DE' } }],
  },
];

const render = (input: unknown, props = {}) =>
  renderToStaticMarkup(
    <ScholarshipCards scholarships={toScholarshipCards(input)} {...props} />,
  );

describe('ScholarshipCards', () => {
  it('prints what the award records', () => {
    const html = render(rows);
    expect(html).toContain('Global Excellence Award');
    expect(html).toContain('Partial tuition');
    expect(html).toContain('Ministry of Education');
    expect(html).toContain('EUR 7,500');
    expect(html).toContain('31 Mar 2027');
    expect(html).toContain('Minimum 70% in the qualifying degree.');
    expect(html).toContain('href="/scholarships/global-excellence"');
  });

  it('uses the stylesheet’s own class names', () => {
    /* The reference build shipped this card's CSS and nothing rendered it;
       the guides invented `schcard__t`, which the stylesheet never defined,
       so the heading was unstyled as well as bare. */
    const html = render(rows);
    expect(html).toContain('schcard__name');
    expect(html).toContain('schcard__facts');
    expect(html).not.toContain('schcard__t"');
  });

  it('marks each destination with its ISO code', () => {
    const html = render(rows);
    expect(html).toContain('flagchip__code');
    expect(html).toContain('>DE<');
  });

  it('drops the destinations when the page is already about one', () => {
    expect(render(rows, { showCountries: false })).not.toContain('flagchip');
  });

  it('leaves out every line the record does not hold', () => {
    const html = render([{ title: 'Bare award', slug: 'bare' }]);
    expect(html).toContain('Bare award');
    // No award, no deadline: no facts list at all rather than empty cells.
    expect(html).not.toContain('schcard__facts');
    expect(html).not.toContain('Deadline');
    expect(html).not.toContain('—');
  });

  it('still names an award that states no benefit type', () => {
    const html = render([{ title: 'Bare award', slug: 'bare' }]);
    expect(html).toContain('Scholarship');
  });

  it('keeps a deadline that has already passed', () => {
    // Purity: whether it is open is the finder's filter, not this render's.
    expect(render([{ ...rows[0], deadline: '2001-03-01' }])).toContain('1 Mar 2001');
  });

  it('sums up the destinations past the fourth rather than listing them all', () => {
    const many = [
      {
        ...rows[0],
        countries: ['Germany', 'Ireland', 'France', 'Spain', 'Italy', 'Poland'].map(
          (name) => ({ country: { name, slug: name.toLowerCase(), iso2Code: null } }),
        ),
      },
    ];
    const html = render(many);
    expect(html).toContain('Germany');
    expect(html).toContain('+2 more');
    expect(html).not.toContain('Poland');
  });

  it('stands down rather than rendering an empty grid', () => {
    expect(render([])).toBe('');
    expect(render([{ title: 'No slug' }])).toBe('');
  });

  it('asks for two columns when told to', () => {
    expect(render(rows, { columns: 2 })).not.toContain('schgrid--3');
    expect(render(rows)).toContain('schgrid--3');
  });
});
