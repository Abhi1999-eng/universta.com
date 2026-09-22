import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CountryGuidance, CountryWorkVisa } from './CountryGuideSections';

type WorkVisaProps = Parameters<typeof CountryWorkVisa>[0];

describe('guidance cards', () => {
  /* The admin writes a card's description in its rich text editor, so it
     arrives as HTML. Printed as text it showed "<p>…</p>" on the page. */
  it('renders the description as the rich text it was written in', () => {
    const html = renderToStaticMarkup(
      <CountryGuidance
        n="14"
        alt={false}
        cards={[{ id: 'c1', title: 'Talk to a counsellor', shortDescription: '<p>Free, and no obligation.</p>' }]}
      />,
    );
    expect(html).toContain('<p>Free, and no obligation.</p>');
    expect(html).not.toContain('&lt;p&gt;');
  });
});

describe('visa card', () => {
  const props = (visaFeeCurrencyCode: string | null): WorkVisaProps =>
    ({
      n: '11',
      country: { name: 'Germany', currency: { code: 'EUR', symbol: '€', name: 'Euro' } },
      profiles: {
        work: { visaType: 'National student visa', visaFee: '75', visaFeeCurrencyCode },
      },
      work: [{ title: 'Work while you study', value: '20 hours a week', body: null }],
    }) as unknown as WorkVisaProps;

  it('prints a fee in the country’s own currency with its symbol', () => {
    expect(renderToStaticMarkup(<CountryWorkVisa {...props('EUR')} />)).toContain('€75');
  });

  it('keeps the code for a fee in another currency', () => {
    expect(renderToStaticMarkup(<CountryWorkVisa {...props('USD')} />)).toContain('USD 75');
  });
});
