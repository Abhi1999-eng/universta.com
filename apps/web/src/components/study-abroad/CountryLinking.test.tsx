import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CountryGuideLinks } from './CountryGuideLinks';
import { StudyPaths } from './CountrySections';
import { CountryTabs, countryTabs } from './CountryTabs';
import { CountryTrail } from './CountryTrail';
import { DestinationSwitcher } from './DestinationSwitcher';
import { RowCard, countLabel, initials } from './RowCard';

/**
 * How a country and a subject link to each other.
 *
 * The links were mostly there. What was missing was where some of them went
 * -- a reader on the Engineering page who picked the United Kingdom was
 * handed the country's general guide, not Engineering in the United Kingdom
 * -- and anything on the page saying that a thing could be pressed.
 */

const uk = { name: 'United Kingdom', slug: 'uk', iso2Code: 'GB' };

describe('the line under a heading', () => {
  it('links the country to its guide and the subject to its own page', () => {
    const html = renderToStaticMarkup(
      <CountryTrail
        country={uk}
        parts={[{ label: 'Energy, Oil & Gas', href: '/subjects/energy-oil-gas' }]}
      />,
    );
    expect(html).toContain('href="/study-abroad/uk"');
    expect(html).toContain('href="/subjects/energy-oil-gas"');
    expect(html).toContain('United Kingdom');
  });

  it('puts the flag inside the country link, so pressing the flag works', () => {
    const html = renderToStaticMarkup(<CountryTrail country={uk} />);
    const link = /<a[^>]*href="\/study-abroad\/uk"[^>]*>(.*?)<\/a>/.exec(html);
    expect(link?.[1]).toContain('cchip__mark');
  });

  it('shows the page being read as text, not as a link to itself', () => {
    const html = renderToStaticMarkup(
      <CountryTrail
        country={uk}
        parts={[
          { label: 'Energy, Oil & Gas', href: '/study-abroad/uk/energy-oil-gas' },
          { label: 'Energy Economics' },
        ]}
      />,
    );
    expect(html).toMatch(/<span[^>]*aria-current="page"[^>]*>Energy Economics<\/span>/);
    expect(html).not.toMatch(/<a[^>]*>Energy Economics<\/a>/);
  });

  it('keeps each dot with the part before it, so a wrapped line never opens on one', () => {
    const html = renderToStaticMarkup(
      <CountryTrail
        country={uk}
        parts={[{ label: 'Law', href: '/subjects/law' }, { label: 'Tax Law' }]}
      />,
    );
    const steps = html.split('class="trail__step"').slice(1);
    expect(steps).toHaveLength(3);
    /* Two dots for three parts, and none trailing the last. */
    expect(steps[0]).toContain('trail__dot');
    expect(steps[1]).toContain('trail__dot');
    expect(steps[2]).not.toContain('trail__dot');
  });
});

describe('picking a country from a subject’s page', () => {
  const countries = [{ id: 'c1', name: 'United Kingdom', slug: 'uk', iso2Code: 'GB' }];

  it('opens that subject in that country', () => {
    const html = renderToStaticMarkup(
      <DestinationSwitcher
        countries={countries}
        label="Energy, Oil & Gas"
        within="energy-oil-gas"
      />,
    );
    expect(html).toContain('href="/study-abroad/uk/energy-oil-gas"');
    expect(html).not.toContain('href="/study-abroad/uk"');
  });

  it('opens that specialization in that country, from a specialization’s page', () => {
    const html = renderToStaticMarkup(
      <DestinationSwitcher
        countries={countries}
        label="Energy Economics"
        within="energy-oil-gas/energy-economics"
      />,
    );
    expect(html).toContain('href="/study-abroad/uk/energy-oil-gas/energy-economics"');
  });

  it('says where the chip goes, since the chip shows the country alone', () => {
    const html = renderToStaticMarkup(
      <DestinationSwitcher countries={countries} label="Law" within="law" />,
    );
    expect(html).toContain('aria-label="Law in United Kingdom"');
  });

  it('still opens the guide where no subject is in play', () => {
    const html = renderToStaticMarkup(
      <DestinationSwitcher countries={countries} label="anything" />,
    );
    expect(html).toContain('href="/study-abroad/uk"');
  });
});

describe('the subjects named on a study path', () => {
  const paths = [
    { id: 'bachelors', label: "Bachelor's", duration: null, entry: null, note: null, courseCount: null },
  ];

  it('are links to that subject in this country', () => {
    const html = renderToStaticMarkup(
      <StudyPaths
        alt={false}
        countryName="United Kingdom"
        paths={paths}
        fields={[{ name: 'Engineering', href: '/study-abroad/uk/engineering' }]}
      />,
    );
    expect(html).toMatch(
      /<a[^>]*class="pill"[^>]*href="\/study-abroad\/uk\/engineering"[^>]*>Engineering/,
    );
  });

  it('stay plain where a caller has only a name to give', () => {
    const html = renderToStaticMarkup(
      <StudyPaths alt={false} countryName="X" paths={paths} fields={['Engineering']} />,
    );
    expect(html).toContain('<span class="pill">Engineering</span>');
  });
});

describe('a card that is a link', () => {
  it('says what is inside and that it opens', () => {
    const html = renderToStaticMarkup(
      <RowCard
        href="/study-abroad/uk/engineering"
        title="Engineering"
        meta={countLabel(45, 'specialization')}
        mark
      />,
    );
    expect(html).toContain('href="/study-abroad/uk/engineering"');
    expect(html).toContain('45 specializations');
    expect(html).toContain('h-card__go');
    expect(html).toContain('>EN<');
  });

  it('agrees in number, and says nothing about a count of none', () => {
    expect(countLabel(1, 'specialization')).toBe('1 specialization');
    expect(countLabel(18, 'course')).toBe('18 courses');
    expect(countLabel(0, 'course')).toBeNull();
    expect(countLabel(undefined, 'course')).toBeNull();
  });

  it('reads "Health & Medicine" as HM rather than H&', () => {
    expect(initials('Health & Medicine')).toBe('HM');
    expect(initials('Law')).toBe('LA');
  });
});

describe('the way from a subject back into the country’s guide', () => {
  const links = [
    { key: 'intakes', label: 'Intakes', href: '/study-abroad/uk#intakes' },
    { key: 'faq', label: 'FAQs', href: '/study-abroad/uk#faq' },
  ];

  it('offers each part of the guide it was given, and the guide itself', () => {
    const html = renderToStaticMarkup(
      <CountryGuideLinks countrySlug="uk" where="the United Kingdom" links={links} />,
    );
    expect(html).toContain('Plan your studies in the United Kingdom');
    expect(html).toContain('href="/study-abroad/uk#intakes"');
    expect(html).toContain('href="/study-abroad/uk#faq"');
    expect(html).toMatch(/href="\/study-abroad\/uk"[^>]*>Study in the United Kingdom/);
  });

  it('stands down when the guide has nothing to link into', () => {
    expect(
      renderToStaticMarkup(
        <CountryGuideLinks countrySlug="uk" where="the United Kingdom" links={[]} />,
      ),
    ).toBe('');
  });
});

describe('the tab strip', () => {
  const tabs = countryTabs('uk', { subjects: 30, universities: 0, scholarships: 0 });

  it('reads "Subjects 30", with a space a screen reader can hear', () => {
    const html = renderToStaticMarkup(<CountryTabs tabs={tabs} current="subjects" />);
    expect(html).toMatch(/Subjects(<!-- -->)? (<!-- -->)?<em>30<\/em>/);
  });

  it('marks the tab being read as the current page', () => {
    const html = renderToStaticMarkup(<CountryTabs tabs={tabs} current="subjects" />);
    expect(html).toMatch(/aria-current="page"[^>]*>Subjects/);
    expect(html).not.toContain('aria-current="true"');
  });
});
