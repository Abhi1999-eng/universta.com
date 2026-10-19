// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StoryCard } from './RecordDirectory';
import { StoryGuide } from './RecordGuide';

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
