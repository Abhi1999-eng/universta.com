import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConnectBand, MatchBand } from './DiscoveryBands';
import { CountryConsultants } from './CountryConsultants';

/**
 * The closing bands a university's page shares with the rest of the site,
 * and what each now takes from the page so it can speak about this
 * university rather than in general.
 */
describe('the bands that close a university’s page', () => {
  it('sends "Talk to a consultant" where the page says, and to the contact page otherwise', () => {
    expect(renderToStaticMarkup(<MatchBand href="/courses" />)).toContain('href="/contact"');
    expect(
      renderToStaticMarkup(
        <MatchBand
          href="/courses"
          talkHref={'/counselling?source=country&country=germany&from=/universities/x'}
        />,
      ),
    ).toContain(
      'href="/counselling?source=country&amp;country=germany&amp;from=/universities/x"',
    );
  });

  it('counts a group by its real total, and gives a row its second line', () => {
    const markup = renderToStaticMarkup(
      <ConnectBand
        actions={[]}
        groups={[
          {
            title: 'Courses at Elmswood',
            total: 9,
            items: [{ id: 'a', name: 'MSc Data', href: '/a', note: "Master's · 1 year" }],
          },
          { title: 'Subjects', items: [{ id: 'b', name: 'Law', href: '/b' }] },
        ]}
      />,
    );
    expect(markup).toContain('<span class="h-count__n">9</span>');
    expect(markup).toContain('<span class="h-count__n">1</span>');
    expect(markup).toContain("<span>Master&#x27;s · 1 year</span>");
  });

  it('asks the consultants question about the university when told to', () => {
    const presence = { total: 2, cities: [] };
    expect(
      renderToStaticMarkup(
        <CountryConsultants countryName="Germany" countrySlug="germany" presence={presence} alt={false} />,
      ),
    ).toContain('Need help applying to Germany?');
    expect(
      renderToStaticMarkup(
        <CountryConsultants
          countryName="Germany"
          countrySlug="germany"
          presence={presence}
          alt={false}
          heading="Need help applying to Elmswood?"
        />,
      ),
    ).toContain('Need help applying to Elmswood?');
  });
});
