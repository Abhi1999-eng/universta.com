import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CountryConsultants } from './CountryConsultants';

const presence = (total: number) => ({ total, cities: [{ city: 'Delhi', count: total }] });

describe('the consultants block on a destination\'s pages', () => {
  it('asks a reader to view one consultant\'s profile, not to compare one', () => {
    const html = renderToStaticMarkup(
      <CountryConsultants countryName="Japan" countrySlug="japan" presence={presence(1)} alt={false} />,
    );
    expect(html).toContain(
      'One consultant on Universta supports students planning to study in Japan. View their profile, then request guidance through Universta.',
    );
    expect(html).not.toContain('Compare them');
  });

  it('adds "Get guidance through Universta" beside "View all consultants" where the page asks for it', () => {
    const html = renderToStaticMarkup(
      <CountryConsultants
        countryName="Japan"
        countrySlug="japan"
        presence={presence(3)}
        alt={false}
        guidanceFrom="/universities/university-of-tokyo"
      />,
    );
    expect(html).toContain('View all consultants');
    expect(html).toContain(
      'class="btn btn--ghost" href="/counselling?source=country&amp;country=japan&amp;from=%2Funiversities%2Funiversity-of-tokyo">Get guidance through Universta<',
    );
  });

  it('leaves the second button out where the page does not ask for it', () => {
    const html = renderToStaticMarkup(
      <CountryConsultants countryName="Japan" countrySlug="japan" presence={presence(3)} alt={false} />,
    );
    expect(html).not.toContain('Get guidance through Universta');
  });

  it('still invites a comparison when there are several', () => {
    const html = renderToStaticMarkup(
      <CountryConsultants countryName="Japan" countrySlug="japan" presence={presence(3)} alt={false} />,
    );
    expect(html).toContain('3 consultants on Universta support students planning to study in Japan. Compare them');
  });
});
