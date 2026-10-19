// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JobCard, jobSearchText, TestimonialCard } from './RecordDirectory';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('TestimonialCard -- the zip quote card on /testimonials (T-G1)', () => {
  it('prints a 525-character quote whole, with no way to lose its end (T-M1)', () => {
    const quote = `${'The counsellors walked me through every document. '.repeat(11)}THE-END-MARKER`.slice(-525);
    expect(quote).toHaveLength(525);
    const html = renderToStaticMarkup(<TestimonialCard row={{ id: 't1', quote, attribution: 'Aarti Nair' }} />);
    expect(html).toContain('THE-END-MARKER');
    expect(html).not.toContain('…');
  });

  it('draws the quote mark, the quote, the initials, the name and the role line', () => {
    const html = renderToStaticMarkup(
      <TestimonialCard row={{ id: 't1', quote: 'It made the shortlist obvious.', attribution: 'Aarti Nair', attributionNote: 'Master’s applicant' }} />,
    );
    const doc = parse(html);
    expect(doc.querySelector('figure.quote .quote__mark')).not.toBeNull();
    expect(doc.querySelector('blockquote.quote__t')?.textContent).toBe('It made the shortlist obvious.');
    expect(doc.querySelector('.quote__by .quote__init')?.textContent).toBe('AN');
    expect(doc.querySelector('.quote__n')?.textContent).toBe('Aarti Nair');
    expect(doc.querySelector('.quote__r')?.textContent).toBe('Master’s applicant');
  });

  it("names the university, linked, and the general course rather than the offering's long name (T-C3-web)", () => {
    const html = renderToStaticMarkup(
      <TestimonialCard
        row={{
          id: 't1',
          quote: 'Clear advice.',
          attribution: 'Kenji Sato',
          university: { id: 'u1', name: 'The University of Tokyo', slug: 'university-of-tokyo' },
          offering: {
            id: 'o1',
            name: 'Doctor of Philosophy in Information Science at The University of Tokyo',
            slug: 'phd-is',
            university: { id: 'u1', name: 'The University of Tokyo', slug: 'university-of-tokyo', country: { slug: 'japan' } },
            genericCourse: { id: 'c1', name: 'PhD Information Science', slug: 'phd-information-science' },
          },
          country: { id: 'jp', name: 'Japan', slug: 'japan' },
        }}
      />,
    );
    const doc = parse(html);
    expect(doc.querySelector('.quote__by a')?.getAttribute('href')).toBe('/universities/university-of-tokyo');
    const line = [...doc.querySelectorAll('.quote__r')].map((node) => node.textContent).join('|');
    expect(line).toBe('The University of Tokyo · PhD Information Science · Japan');
    expect(html).not.toContain('Doctor of Philosophy in Information Science at');
  });

  it('keeps a caption with the university when the quote has no attribution', () => {
    const html = renderToStaticMarkup(
      <TestimonialCard row={{ id: 't1', quote: 'Unsigned.', attribution: null, university: { name: 'Kyoto University', slug: 'kyoto' } }} />,
    );
    const doc = parse(html);
    expect(doc.querySelector('figcaption.quote__by')?.textContent).toContain('Kyoto University');
    expect(doc.querySelector('.quote__n')).toBeNull();
  });

  it("shows the editor's photo in the avatar, with initials as the fallback (T-C6-web)", () => {
    const withPhoto = parse(
      renderToStaticMarkup(
        <TestimonialCard
          row={{ id: 't1', quote: 'Q.', attribution: 'Aarti Nair', imageMedia: { id: 'm1', publicUrl: '/media/aarti.jpg', altText: null, title: null } }}
        />,
      ),
    );
    const img = withPhoto.querySelector('.quote__init img');
    expect(img?.getAttribute('src')).toBe('/media/aarti.jpg');
    expect(img?.getAttribute('alt')).toBe('Aarti Nair');
    expect(withPhoto.querySelector('.quote__init')?.textContent).toBe('');

    const without = parse(renderToStaticMarkup(<TestimonialCard row={{ id: 't2', quote: 'Q.', attribution: 'Aarti Nair', imageMedia: null }} />));
    expect(without.querySelector('.quote__init')?.textContent).toBe('AN');
  });

  it('reads an older API that sends no relations at all', () => {
    const html = renderToStaticMarkup(<TestimonialCard row={{ id: 't1', quote: 'Q.', attribution: 'A B', universityId: 'u1', offeringId: 'o1' }} />);
    expect(parse(html).querySelectorAll('.quote__r')).toHaveLength(0);
  });
});

describe('JobCard (JOB-G4)', () => {
  const now = Date.parse('2026-10-19T12:00:00Z');
  const role = (extra: Record<string, unknown> = {}) => ({
    id: 'j1',
    slug: 'admissions-analyst',
    title: 'Admissions analyst',
    department: 'Admissions',
    location: 'Kyoto',
    description: '<p>{jobTitle} in {jobDepartment}.</p>',
    employmentType: 'Full-time',
    remoteStatus: 'HYBRID',
    publishedDate: '2026-10-01T00:00:00.000Z',
    expiryDate: '2026-12-31T00:00:00.000Z',
    ...extra,
  });
  const card = (extra: Record<string, unknown> = {}) => parse(renderToStaticMarkup(<JobCard row={role(extra)} now={now} />));

  it('shows the type as a pill at the top, read the one way (JOB-C5-web)', () => {
    const doc = card();
    expect(doc.querySelector('a.h-card > .fundbadge')?.textContent).toBe('Full time');
    expect(doc.querySelector('a.h-card > .h-card__m')?.textContent).toBe('Admissions · Hybrid');
    expect(card({ employmentType: 'FULL_TIME' }).querySelector('.fundbadge')?.textContent).toBe('Full time');
    expect(card({ employmentType: null }).querySelector('.fundbadge')).toBeNull();
  });

  it("fills in the description's variables when there is no summary (JOB-C3)", () => {
    expect(card().querySelector('.h-card__d')?.textContent).toBe('Admissions analyst in Admissions.');
  });

  it('says when it closes and when it was posted, with Closing soon only in the last 21 days (JOB-G4, JOB-C8)', () => {
    expect(card().querySelector('.jobcard__when')?.textContent).toBe('Kyoto · Closes 31 Dec 2026 · Posted 1 Oct 2026');
    expect(card().querySelector('.badge')).toBeNull();
    const soon = card({ expiryDate: '2026-11-01T00:00:00.000Z', publishedDate: null });
    expect(soon.querySelector('.jobcard__when')?.textContent).toBe('Kyoto · Closes 1 Nov 2026 Closing soon');
    expect(soon.querySelector('.badge.badge--req')?.textContent).toBe('Closing soon');
    expect(card({ expiryDate: null }).querySelector('.badge')).toBeNull();
  });

  it('is searched by title, team and place (JOB-G3)', () => {
    expect(jobSearchText(role({ city: { name: 'Kyoto City' }, country: { name: 'Japan' } }))).toBe(
      'Admissions analyst Admissions Kyoto Kyoto City Japan Full time Hybrid',
    );
  });
});
