// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StoryCard } from './RecordDirectory';
import { EventGuide, JobGuide, StoryGuide } from './RecordGuide';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

const story = (extra: Record<string, unknown> = {}) => ({
  id: 's1',
  slug: 'from-pune-to-tokyo',
  title: 'From Pune to Tokyo',
  attribution: 'Aarti Nair',
  attributionNote: 'MEng applicant, 2026 intake',
  journey: '<p>At {universityName} I learnt to apply early.</p>',
  university: { name: 'The University of Tokyo', slug: 'university-of-tokyo' },
  ...extra,
});

describe('StoryCard', () => {
  it('fills in the journey variables the story page fills in (SS-C3)', () => {
    const html = renderToStaticMarkup(<StoryCard row={story()} />);
    expect(html).toContain('At The University of Tokyo I learnt to apply early.');
    expect(html).not.toContain('{universityName}');
  });

  it("draws the student's byline with initials and the note above the link (SS-U4)", () => {
    const doc = parse(renderToStaticMarkup(<StoryCard row={story()} />));
    const byline = doc.querySelector('a.h-card .quote__by');
    expect(byline?.querySelector('.quote__init')?.textContent).toBe('AN');
    expect(byline?.querySelector('.quote__n')?.textContent).toBe('Aarti Nair');
    expect(byline?.querySelector('.quote__r')?.textContent).toBe('MEng applicant, 2026 intake');
    expect(byline?.nextElementSibling?.textContent).toContain('Read the story');
  });
});

describe('StoryGuide', () => {
  it('puts the journey in the article column with the byline card and its plan link beside it (SS-U1, SS-U4)', () => {
    const doc = parse(renderToStaticMarkup(<StoryGuide row={story()} />));
    const article = doc.querySelector('#journey .wrap.h-article');
    expect(article?.querySelector('.h-article__main .h-prose')?.textContent).toBe('At The University of Tokyo I learnt to apply early.');
    const aside = article?.querySelector('aside.h-aside .h-card');
    expect(aside?.querySelector('.quote__n')?.textContent).toBe('Aarti Nair');
    expect(aside?.querySelector('a.btn')?.getAttribute('href')).toBe(
      '/counselling?source=general&from=%2Fsuccess-stories%2Ffrom-pune-to-tokyo',
    );
    /* The relation cards stay under the story, not repeated in the aside. */
    expect(aside?.querySelector('a[href^="/universities/"]')).toBeNull();
    expect(article?.querySelector('.h-article__main a[href="/universities/university-of-tokyo"]')).not.toBeNull();
    /* The hero keeps the plain attribution line. */
    expect(doc.querySelector('.hero__sub')?.textContent).toBe('Aarti Nair');
  });

  it('closes the journey with a note that this is one student’s experience (SS-U6)', () => {
    const doc = parse(renderToStaticMarkup(<StoryGuide row={story()} />));
    expect(doc.querySelector('.h-prose + .h-note')?.textContent).toMatch(/one student’s own account/);
  });

  it('shows the no-text note for an emptied editor, not an empty band (SS-M1)', () => {
    const doc = parse(renderToStaticMarkup(<StoryGuide row={story({ journey: '<p><br></p>' })} />));
    expect(doc.querySelector('.h-prose')).toBeNull();
    expect(doc.body.textContent).toContain('The story has been published without its text.');
  });

  it("links the programme card to the course's own address (SS-C9)", () => {
    const doc = parse(
      renderToStaticMarkup(
        <StoryGuide
          row={story({
            offering: {
              name: 'MEng Civil Engineering at The University of Tokyo',
              slug: 'meng-civil',
              university: { slug: 'university-of-tokyo', country: { slug: 'japan' } },
              genericCourse: { name: 'MEng Civil Engineering', slug: 'meng-civil-engineering' },
            },
          })}
        />,
      ),
    );
    const programme = [...doc.querySelectorAll('#journey a.h-card')].find((card) => card.textContent?.includes('Programme'));
    expect(programme?.getAttribute('href')).toBe('/study-abroad/japan/universities/university-of-tokyo/courses/meng-civil');
  });

  it('offers more stories before the closing band, and none when there are none (SS-U2)', () => {
    const others = [story({ id: 's2', slug: 'b', title: 'B' }), story({ id: 's3', slug: 'c', title: 'C' })];
    const doc = parse(renderToStaticMarkup(<StoryGuide row={story()} more={others} />));
    const band = doc.querySelector('#more-stories');
    expect(band?.querySelectorAll('a.h-card')).toHaveLength(2);
    expect(band?.querySelector('.h-more a')?.getAttribute('href')).toBe('/success-stories');
    expect(parse(renderToStaticMarkup(<StoryGuide row={story()} />)).querySelector('#more-stories')).toBeNull();
  });
});

const now = Date.parse('2026-10-19T12:00:00Z');
const guides = new Set(['japan']);

const event = (extra: Record<string, unknown> = {}) => ({
  id: 'e1',
  slug: 'tokyo-open-evening',
  title: 'Tokyo open evening',
  summary: 'Meet the admissions team.',
  description: '<p>Join us for {eventTitle} on {eventDate} at {eventVenue}.</p>',
  startsAt: '2026-11-20T09:00:00.000Z',
  endsAt: '2026-11-20T10:30:00.000Z',
  timezone: 'Asia/Tokyo',
  eventType: 'OFFLINE',
  venue: 'Shibuya Hall',
  city: { name: 'Tokyo', slug: 'tokyo' },
  country: { name: 'Japan', slug: 'japan', iso2Code: 'JP' },
  registrationUrl: 'https://register.example.test/tokyo',
  ...extra,
});

describe('EventGuide', () => {
  const page = (extra: Record<string, unknown> = {}, at = now, more: Record<string, unknown>[] = []) =>
    parse(renderToStaticMarkup(<EventGuide row={event(extra)} guides={guides} now={at} more={more.map((row) => event(row))} />));

  it('draws an event whose zone was mistyped, in the site zone (EV-C3)', () => {
    const doc = page({ timezone: 'Tokyo' });
    expect(doc.querySelector('.deadlinecard .deadlinecard__row span:last-child')?.textContent).toBe('2:30 pm – 4:00 pm IST');
  });

  it('fills in the description variables (EV-M1)', () => {
    const prose = page().querySelector('#overview .h-prose')?.textContent;
    expect(prose).toMatch(/^Join us for Tokyo open evening on .+ at Shibuya Hall\.$/);
  });

  it('sets the description beside its heading, in the split head (EV-U5, JOB-G2)', () => {
    const doc = page();
    expect(doc.querySelector('#overview.recordband .sec-head--split > div:last-child .h-prose')).not.toBeNull();
  });

  it("puts the dark When card in the hero's right half, with the status and Register (EV-U4, EV-U1)", () => {
    const card = page().querySelector('.coursehero__grid .recordhero__aside aside.deadlinecard');
    expect(card?.querySelector('.deadlinecard__date')?.textContent).toBe('20 Nov 2026');
    const rows = Object.fromEntries([...(card?.querySelectorAll('.deadlinecard__row') ?? [])].map((row) => [row.querySelector('.label')?.textContent, row]));
    expect(rows.Time?.textContent).toBe('Time6:00 pm – 7:30 pm JST');
    expect(rows.Status?.querySelector('.badge')?.textContent).toBe('Upcoming');
    expect(card?.querySelector('a.btn')?.getAttribute('href')).toBe('https://register.example.test/tokyo');
  });

  it('keeps the note and says Ended once the event is over, with no Register anywhere (EV-U1, EV-U6)', () => {
    const doc = page({}, Date.parse('2026-12-01T00:00:00Z'));
    expect(doc.querySelector('.examtests__note')?.textContent).toBe('This event has already taken place.');
    expect(doc.querySelector('.deadlinecard .badge')?.textContent).toBe('Ended');
    expect(doc.querySelector('a[href="https://register.example.test/tokyo"]')).toBeNull();
  });

  it('names the venue, city and country in the place cell (EV-C8-web)', () => {
    const cells = Object.fromEntries([...page().querySelectorAll('.unisnap__cell')].map((cell) => [cell.querySelector('.label')?.textContent, cell]));
    expect(cells.Venue?.querySelector('b')?.textContent).toBe('Shibuya Hall, TokyoJPJapan');
    expect(cells.Venue?.querySelector('a.flagchip')?.getAttribute('href')).toBe('/study-abroad/japan');
  });

  it('lists the speakers as name cards, and leaves the band out without any (EV-C4)', () => {
    const doc = page({ speakersJson: ['Aiko Tanaka', 'Ravi Menon'] });
    expect([...doc.querySelectorAll('#speakers .speakers__card strong')].map((name) => name.textContent)).toEqual(['Aiko Tanaka', 'Ravi Menon']);
    expect(doc.querySelector('#speakers')?.textContent).not.toMatch(/official event listing/);
    expect(page({ speakersJson: [] }).querySelector('#speakers')).toBeNull();
    expect(page({ speakersJson: null }).querySelector('#speakers')).toBeNull();
  });

  it('draws the event picture in the hero (EV-C5-web)', () => {
    const img = page({ featuredMedia: { id: 'm', publicUrl: '/media/hall.jpg', altText: null, title: null } }).querySelector('.recordhero__media img');
    expect(img?.getAttribute('alt')).toBe('Tokyo open evening');
  });

  it('closes with more upcoming events, linked to the list (EV-U6)', () => {
    const doc = page({}, now, [{ id: 'a', slug: 'a', title: 'Osaka fair' }]);
    expect(doc.querySelector('#more-events h2')?.textContent).toBe('More upcoming events');
    expect(doc.querySelector('#more-events article .eventcard__link')?.getAttribute('href')).toBe('/events/a');
    expect(page().querySelector('#more-events')).toBeNull();
  });
});

const role = (extra: Record<string, unknown> = {}) => ({
  id: 'j1',
  slug: 'admissions-analyst',
  title: 'Admissions analyst',
  department: 'Admissions',
  location: 'Kyoto',
  summary: 'Read applications with the team.',
  description: '<p>{jobTitle} in {jobDepartment}.</p>',
  employmentType: 'FULL_TIME',
  remoteStatus: 'REMOTE',
  applicationUrl: 'https://jobs.example.test/apply',
  applicationEmail: 'hiring-team@universta.example.test',
  publishedDate: '2026-10-01T00:00:00.000Z',
  expiryDate: '2026-12-31T00:00:00.000Z',
  ...extra,
});

describe('JobGuide', () => {
  const page = (extra: Record<string, unknown> = {}, at = now) => parse(renderToStaticMarkup(<JobGuide row={role(extra)} now={at} />));
  const cells = (doc: Document) =>
    Object.fromEntries([...doc.querySelectorAll('.unisnap__cell')].map((cell) => [cell.querySelector('.label')?.textContent, cell]));

  it("fills in the description's variables (JOB-C3)", () => {
    expect(page().querySelector('#overview .h-prose')?.textContent).toBe('Admissions analyst in Admissions.');
  });

  it('says "Apply for this role" and keeps the new-tab arrow (JOB-C10)', () => {
    expect(page().querySelector('.hero .btn-row a.btn--lg')?.textContent).toBe('Apply for this role ↗');
  });

  it("puts the zip's deadline card beside the title: date, status, posted and apply (JOB-G1, JOB-C8)", () => {
    const card = page().querySelector('.recordhero__aside aside.deadlinecard');
    expect(card?.querySelector('.deadlinecard__date')?.textContent).toBe('31 Dec 2026');
    const rows = Object.fromEntries([...(card?.querySelectorAll('.deadlinecard__row') ?? [])].map((row) => [row.querySelector('.label')?.textContent, row]));
    expect(rows.Status?.querySelector('.badge.badge--ok')?.textContent).toBe('Open');
    expect(rows.Posted?.textContent).toBe('Posted1 Oct 2026');
    expect(card?.querySelector('a.btn')?.getAttribute('href')).toBe('https://jobs.example.test/apply');
  });

  it('reads Closing soon in the last 21 days, and No closing date set without one (JOB-G1)', () => {
    expect(page({ expiryDate: '2026-11-01T00:00:00.000Z' }).querySelector('.deadlinecard .badge')?.textContent).toBe('Closing soon');
    const open = page({ expiryDate: null, publishedDate: null });
    expect(open.querySelector('.deadlinecard__varies')?.textContent).toBe('No closing date set');
    expect(open.querySelector('.deadlinecard .badge')?.textContent).toBe('Open');
    expect(open.querySelector('.deadlinecard')?.textContent).not.toContain('Posted');
  });

  it('closes the role the day after its closing date, by the UTC date (JOB-C1-web, JOB-M3-web)', () => {
    const lastDay = page({ expiryDate: '2026-10-19T00:00:00.000Z' }, Date.parse('2026-10-19T23:30:00Z'));
    expect(lastDay.querySelector('.examtests__note')).toBeNull();
    expect(lastDay.querySelector('a[href="https://jobs.example.test/apply"]')).not.toBeNull();

    const closed = page({ expiryDate: '2026-10-19T00:00:00.000Z' }, Date.parse('2026-10-20T00:30:00Z'));
    expect(closed.querySelector('.examtests__note')?.textContent).toBe('Applications for this role closed on 19 Oct 2026.');
    expect(closed.querySelector('.deadlinecard .badge')?.textContent).toBe('Closed');
    /* No way to apply is left; the way back and the question stay. */
    expect(closed.querySelector('a[href="https://jobs.example.test/apply"]')).toBeNull();
    expect(closed.querySelector('a[href^="mailto:"]')).toBeNull();
    expect([...closed.querySelectorAll('.hero .btn-row a')].map((link) => link.textContent)).toEqual(['All open roles', 'Ask about this role']);
  });

  it('asks about the role on the contact form with its title as the subject (JOB-C4-web)', () => {
    expect(page().querySelector('.hero a[href^="/contact"]')?.getAttribute('href')).toBe('/contact?subject=Role%3A%20Admissions%20analyst');
  });

  it('reads one label for each type and pattern however it was typed (JOB-C5-web)', () => {
    const doc = page({ employmentType: 'Full-time', remoteStatus: 'On-site' });
    expect(doc.querySelector('.hero__eyebrow')?.textContent).toBe('Role · Admissions · Full time · On site');
    expect(cells(doc).Type?.querySelector('b')?.textContent).toBe('Full time');
    expect(cells(doc).Working?.querySelector('b')?.textContent).toBe('On site');
  });

  it('lets the email break after its @ and its dots (JOB-C7)', () => {
    const mail = cells(page())['Apply by email']?.querySelector('a.unisnap__mail');
    expect(mail?.textContent).toBe('hiring-team@universta.example.test');
    /* A break after the @ and after each dot of the domain, none inside a word. */
    expect([...(mail?.querySelectorAll('span') ?? [])].map((part) => part.innerHTML)).toEqual([
      'hiring-team@',
      '<wbr>universta.',
      '<wbr>example.',
      '<wbr>test',
    ]);
    expect(mail?.getAttribute('href')).toBe('mailto:hiring-team@universta.example.test');
  });

  it('sets the role text beside its heading (JOB-G2)', () => {
    expect(page().querySelector('#overview.recordband .sec-head--split > div:last-child .h-prose')).not.toBeNull();
  });
});
