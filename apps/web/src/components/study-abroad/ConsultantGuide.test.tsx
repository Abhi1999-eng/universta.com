import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => '/study-abroad-consultants/silverbeck',
  useSearchParams: () => new URLSearchParams(),
}));

/* The request form is the counselling page's own; here it only has to say
   what it was given. */
vi.mock('@/components/counselling/CounsellingForm', () => ({
  CounsellingForm: ({ context, initialOptions }: { context: Record<string, string>; initialOptions: unknown }) => (
    <form
      data-testid="counselling"
      data-source-type={context.sourceType}
      data-source-page={context.sourcePagePath}
      data-options={initialOptions ? 'given' : 'loaded'}
    />
  ),
}));

import { ConsultantGuide, type ConsultantGuideProps } from './ConsultantGuide';

const props = (consultant: Partial<ConsultantGuideProps['consultant']> = {}): ConsultantGuideProps => ({
  consultant: {
    name: 'Silverbeck Admissions Collective',
    slug: 'silverbeck',
    shortDescription: 'Counsels students on studying abroad.',
    description: null,
    email: null,
    phone: null,
    websiteUrl: null,
    verified: true,
    verifiedAt: '2026-10-01T00:00:00.000Z',
    sourceReference: null,
    ...consultant,
  },
  countries: [],
  services: ['Visa documentation'],
  languages: ['English'],
  locations: [],
  guides: new Set(),
});

const render = (over: Partial<ConsultantGuideProps['consultant']> = {}) =>
  renderToStaticMarkup(<ConsultantGuide {...props(over)} />);

/** The Verification section's "Last verified" cell. */
const lastVerified = (html: string) =>
  html.match(/<span class="label">Last verified<\/span><b>([^<]*)<\/b>/)?.[1];

describe('a consultant profile\'s website and source', () => {
  it('links an absolute address from the hero, the contact card and the source', () => {
    const html = render({
      websiteUrl: 'https://silverbeck.example',
      sourceReference: 'https://directory.example/silverbeck',
    });
    expect(html.match(/href="https:\/\/silverbeck\.example"/g)).toHaveLength(2);
    expect(html).toContain('Visit website');
    expect(html).toContain('href="https://directory.example/silverbeck"');
  });

  it('shows a bare domain and a note as text, with no link to a page that does not exist', () => {
    const html = render({
      websiteUrl: 'www.audit-consultant.test',
      sourceReference: 'Checked by phone with the office',
    });
    expect(html).not.toContain('href="www.audit-consultant.test"');
    expect(html).not.toContain('Visit website');
    expect(html).toContain('<dd>www.audit-consultant.test</dd>');
    expect(html).not.toContain('href="Checked by phone');
    expect(html).toContain('Checked by phone with the office');
  });
});

describe('a consultant profile\'s About', () => {
  it('sets the description in the head\'s right-hand column, with the destinations and languages below', () => {
    const html = renderToStaticMarkup(
      <ConsultantGuide
        {...props({ description: '<p>We help with visas.</p><p>And with courses.</p>' })}
        countries={[{ name: 'Japan', slug: 'japan' }]}
      />,
    );
    const about = html.slice(html.indexOf('id="about"'), html.indexOf('</section>', html.indexOf('id="about"')));
    const head = about.slice(about.indexOf('sec-head--split'), about.indexOf('admgrid'));
    /* The aside holds the eyebrow and title; the next column holds the copy. */
    expect(head).toMatch(/<\/div><div><div class="rich-text h-prose"><p>We help with visas\.<\/p><p>And with courses\.<\/p><\/div><\/div>/);
    expect(about.indexOf('We help with visas')).toBeLessThan(about.indexOf('Destinations'));
    expect(about).toContain('Languages');
  });

  it('falls back to the short description as the lead', () => {
    const html = render({ description: null });
    expect(html).toContain('<p class="sec-lead">Counsels students on studying abroad.</p>');
  });
});

describe('a consultant profile\'s verification', () => {
  it('dates a verified consultant in the hero and the Verification section', () => {
    const html = render();
    expect(html).toContain('Verified Oct 1, 2026');
    expect(lastVerified(html)).toBe('Oct 1, 2026');
  });

  it('says a verified consultant\'s date was not recorded, never "Not verified"', () => {
    const html = render({ verifiedAt: null });
    expect(lastVerified(html)).toBe('Verified (date not recorded)');
    expect(html).not.toContain('dated the check');
    expect(html).toContain('The date of that check was not recorded.');
  });

  it('prints no date for a consultant that is not verified', () => {
    /* The page passes the record through consultantVerification, which
       drops the date; the guide holds the same rule on its own. */
    const html = render({ verified: false, verifiedAt: '2026-10-01T00:00:00.000Z' });
    expect(html).not.toContain('Oct 1, 2026');
    expect(lastVerified(html)).toBe('Not verified');
    expect(html).toContain('Not yet verified');
  });
});

describe('a consultant profile\'s services', () => {
  it('runs the list in the directory\'s two columns, with no invented group headings', () => {
    const html = renderToStaticMarkup(
      <ConsultantGuide {...props()} services={['Visa documentation', 'Course shortlisting', 'Interview practice']} />,
    );
    expect(html).toContain('<ul class="svclist svcgroups"><li class="svclist__item"><b>Visa documentation</b></li>');
    expect(html).not.toContain('svcgroup__t');
  });
});

describe('a consultant profile\'s Get guidance', () => {
  const section = (html: string) => html.slice(html.indexOf('id="contact"'), html.indexOf('</section>', html.indexOf('id="contact"')));

  it('asks for guidance on the profile, naming the consultant and sending this page as where the request began', () => {
    const html = render();
    const contact = section(html);
    expect(contact).toContain('Want help deciding on a consultant?');
    expect(contact).toContain('weigh up Silverbeck Admissions Collective');
    expect(contact).toContain('data-source-type="general"');
    expect(contact).toContain('data-source-page="/study-abroad-consultants/silverbeck"');
  });

  it('passes the options read on the server to the form', () => {
    const html = renderToStaticMarkup(
      <ConsultantGuide {...props()} counselling={{ countries: [], courseLevels: [], intakes: [] }} />,
    );
    expect(section(html)).toContain('data-options="given"');
    expect(section(render())).toContain('data-options="loaded"');
  });

  it('puts the trust box under the form, once, and keeps the contact card and the match band', () => {
    const html = render({ email: 'hello@silverbeck.example' });
    expect(html.match(/How Universta works with consultants/g)).toHaveLength(2); /* aria-label and heading */
    const contact = section(html);
    expect(contact.indexOf('data-testid="counselling"')).toBeLessThan(contact.indexOf('trustbox'));
    expect(html).toContain('aria-label="Contact"');
    expect(html.indexOf('id="contact"')).toBeLessThan(html.indexOf('Want a second opinion first?'));
  });
});

describe('a consultant profile\'s section strip', () => {
  it('links each section on the page, under the hero, with no Universities tab', () => {
    const html = render();
    const strip = html.slice(html.indexOf('<nav class="unitabs'), html.indexOf('</nav>', html.indexOf('<nav class="unitabs')));
    expect(strip).toContain('aria-label="Consultant sections"');
    expect([...strip.matchAll(/href="#([a-z]+)">([^<]+)</g)].map((match) => `${match[1]}:${match[2]}`)).toEqual([
      'about:About',
      'services:Services',
      'offices:Offices',
      'verification:Verification',
      'contact:Get guidance',
    ]);
    for (const id of ['about', 'services', 'offices', 'verification', 'contact']) expect(html).toContain(`id="${id}"`);
    expect(html.indexOf('hero--compact')).toBeLessThan(html.indexOf('unitabs'));
    expect(strip).not.toContain('Universities');
  });
});

describe('a consultant profile\'s similar consultants', () => {
  const card = (slug: string) => ({
    id: slug,
    name: `Consultant ${slug}`,
    slug,
    summary: null,
    verified: false,
    verifiedAt: null,
    cities: ['Heidelberg'],
    services: [],
    languages: [],
    destinations: [],
  });
  const section = (html: string) =>
    html.includes('id="similar"') ? html.slice(html.indexOf('id="similar"'), html.indexOf('</section>', html.indexOf('id="similar"'))) : '';

  it('shows up to three cards with the compare tick, says how they were chosen, and never mentions sponsorship or subjects', () => {
    const html = renderToStaticMarkup(<ConsultantGuide {...props()} similar={['a', 'b', 'c'].map(card)} />);
    const similar = section(html);
    expect(similar).toContain('Consultants with a similar profile');
    expect(similar).toContain('consultgrid consultgrid--3');
    expect(similar.match(/class="consultcard"/g)).toHaveLength(3);
    expect(similar.match(/aria-label="Compare Consultant /g)).toHaveLength(3);
    expect(similar).toContain('cities, destinations and services they share with Silverbeck Admissions Collective. Paid placement plays no part.');
    expect(similar).not.toMatch(/sponsor|subject/i);
    /* Each card's guidance records the profile it was found on. */
    expect(similar).toContain('href="/counselling?source=general&amp;from=%2Fstudy-abroad-consultants%2Fsilverbeck"');
    expect(html.indexOf('id="contact"')).toBeLessThan(html.indexOf('id="similar"'));
  });

  it('sets a single one beside the heading, not alone in a row', () => {
    const similar = section(renderToStaticMarkup(<ConsultantGuide {...props()} similar={[card('a')]} />));
    expect(similar).toContain('sec-head--split');
    expect(similar).toContain('A consultant with a similar profile');
    expect(similar).toContain('consultgrid consultgrid--one');
  });

  it('leaves the section out when there is no one like this consultant', () => {
    expect(render()).not.toContain('id="similar"');
  });
});
