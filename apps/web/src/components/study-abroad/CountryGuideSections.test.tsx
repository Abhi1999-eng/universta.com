import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CountryGuidance, CountryLanguage, CountryWorkVisa } from './CountryGuideSections';

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

  /* The disclaimer is where an editor says what the rest of the card cannot be
     held to -- rules change, and the country page has to be able to say so.
     It was recorded in the admin and printed nowhere. */
  it('prints the disclaimer an editor recorded against the visa rules', () => {
    const withNote = {
      ...props('EUR'),
      profiles: {
        work: {
          visaType: 'National student visa',
          visaFee: '75',
          visaFeeCurrencyCode: 'EUR',
          disclaimer: '<p>Rules change; confirm with the embassy before you apply.</p>',
        },
      },
    } as unknown as WorkVisaProps;
    const html = renderToStaticMarkup(<CountryWorkVisa {...withNote} />);
    expect(html).toContain('visa__note');
    expect(html).toContain('confirm with the embassy before you apply');
    expect(html).not.toContain('&lt;p&gt;');
  });
});

describe('language table', () => {
  /* The notes column printed "<p>...</p>" at the reader: the cell was the one
     place on the guide that put authored rich text on the page as text. */
  it('renders a note as the rich text it was written in', () => {
    const html = renderToStaticMarkup(
      <CountryLanguage
        n="08"
        alt={false}
        country={{ name: 'Luxembourg' } as never}
        profiles={
          {
            language: {
              ieltsRequirement: 'REQUIRED',
              ieltsMinScore: '6.5',
              ieltsNotes: '<p>No band below 6.0.</p>',
            },
          } as never
        }
      />,
    );
    expect(html).toContain('<p>No band below 6.0.</p>');
    expect(html).not.toContain('&lt;p&gt;');
  });
});
