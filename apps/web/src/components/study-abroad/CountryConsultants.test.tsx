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

  it('still invites a comparison when there are several', () => {
    const html = renderToStaticMarkup(
      <CountryConsultants countryName="Japan" countrySlug="japan" presence={presence(3)} alt={false} />,
    );
    expect(html).toContain('3 consultants on Universta support students planning to study in Japan. Compare them');
  });
});
