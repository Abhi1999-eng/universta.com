import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SubjectLevelPageContent } from '@/lib/catalog';
import { bandTones, EMPLOYERS_NOTE, LevelBandSection, writtenLevelBands } from './LevelPageSections';

/**
 * The bands a level page draws from what an editor wrote, and the shades
 * they take around the programme list.
 */

const names = { levelName: 'MBA', fieldName: 'Finance' };
const content = (over: Partial<SubjectLevelPageContent> = {}): SubjectLevelPageContent => ({
  id: 'page-1',
  intro: '<p>Why.</p>',
  admissionNote: '<p>Entry.</p>',
  careersNote: '<p>Careers.</p>',
  industries: '<p>Banking.</p>',
  employers: '<p>Banks.</p>',
  lookingAhead: '<p>Growing.</p>',
  faqs: [{ id: 'faq-1', question: 'Is it hard?', answer: '<p>Yes.</p>' }],
  updatedAt: '2026-10-18T00:00:00.000Z',
  ...over,
});

describe('the written bands', () => {
  it('heads each part as the page reads it', () => {
    const bands = writtenLevelBands(content(), names);
    expect(Object.fromEntries(Object.entries(bands).map(([key, band]) => [key, [band?.id, band?.eyebrow, band?.title]]))).toEqual({
      overview: ['overview', 'Overview', 'Why study an MBA in Finance?'],
      careers: ['careers', 'Careers', 'Career pathways'],
      industries: ['industries', 'Sectors', 'Industries'],
      employers: ['employers', 'Who hires', 'Employers'],
      admission: ['admission', 'Admission', 'Getting into MBA in Finance'],
      lookingAhead: ['looking-ahead', 'Outlook', 'Looking ahead'],
      faqs: ['faqs', 'Questions', 'Questions about MBA in Finance'],
    });
  });

  it('has none for a page with nothing published', () => {
    expect(Object.values(writtenLevelBands(null, names)).every((band) => band === null)).toBe(true);
  });

  it('draws no part with nothing a reader would see', () => {
    const bands = writtenLevelBands(
      content({ industries: '<p> </p>', employers: null, lookingAhead: undefined, faqs: [{ id: 'faq-1', question: 'Empty?', answer: '<p></p>' }] }),
      names,
    );
    expect(bands.industries).toBeNull();
    expect(bands.employers).toBeNull();
    expect(bands.lookingAhead).toBeNull();
    expect(bands.faqs).toBeNull();
    expect(bands.overview).not.toBeNull();
  });

  it('follows the employers with what naming them means', () => {
    const html = renderToStaticMarkup(<LevelBandSection band={writtenLevelBands(content(), names).employers!} tone="paper" />);
    expect(html).toMatch(/^<section class="sec sec--paper" id="employers">/);
    expect(html).toContain('<h2 class="sec-title">Employers</h2>');
    expect(html).toMatch(new RegExp(`Banks\\.[\\s\\S]*<p class="trust__note">${EMPLOYERS_NOTE.replace(/[.;]/g, '\\$&')}</p>`));
    expect(EMPLOYERS_NOTE).toBe('Named for illustration only; not a ranking, endorsement or partnership.');
  });
});

describe('the shades of the bands', () => {
  it('keeps the list white and alternates outwards from it, paper first', () => {
    expect(bandTones(['a', 'b', 'discovery', 'c', 'd'])).toEqual({ a: 'white', b: 'paper', discovery: 'white', c: 'paper', d: 'white' });
  });

  it('alternates from paper where there is no list', () => {
    expect(bandTones(['a', 'b'])).toEqual({ a: 'paper', b: 'white' });
    expect(bandTones([])).toEqual({});
  });

  it('never puts two of a shade side by side', () => {
    const ids = ['a', 'b', 'c', 'discovery', 'd', 'e', 'f'];
    const tones = bandTones(ids);
    for (let index = 1; index < ids.length; index += 1) expect(tones[ids[index]]).not.toBe(tones[ids[index - 1]]);
  });
});
