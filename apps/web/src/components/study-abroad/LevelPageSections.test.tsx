import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SubjectLevelPageContent } from '@/lib/catalog';
import { bandTones, EMPLOYERS_NOTE, LevelBandSection, LinkChips, MoreLink, writtenLevelBands } from './LevelPageSections';

/**
 * The bands a level page draws from what an editor wrote, and the shades
 * they take around the programme list.
 */

const names = { levelName: 'MBA', fieldName: 'Finance' };
const content = (over: Partial<SubjectLevelPageContent> = {}): SubjectLevelPageContent => ({
  id: 'page-1',
  intro: '<p>Why.</p>',
  studyTopics: '<p>Valuation.</p>',
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
      studyTopics: ['study-topics', 'Curriculum', 'What you may study'],
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
      content({ studyTopics: '  ', industries: '<p> </p>', employers: null, lookingAhead: undefined, faqs: [{ id: 'faq-1', question: 'Empty?', answer: '<p></p>' }] }),
      names,
    );
    expect(bands.studyTopics).toBeNull();
    expect(bands.industries).toBeNull();
    expect(bands.employers).toBeNull();
    expect(bands.lookingAhead).toBeNull();
    expect(bands.faqs).toBeNull();
    expect(bands.overview).not.toBeNull();
  });

  it('has no topics band for an API that sends none', () => {
    const { studyTopics, ...older } = content();
    void studyTopics;
    expect(writtenLevelBands(older, names).studyTopics).toBeNull();
  });

  it('draws the topics as the other notes are drawn', () => {
    const html = renderToStaticMarkup(<LevelBandSection band={writtenLevelBands(content(), names).studyTopics!} tone="white" />);
    expect(html).toMatch(/^<section class="sec sec--white" id="study-topics">/);
    expect(html).toContain('<h2 class="sec-title">What you may study</h2>');
    expect(html).toContain('<div class="prose"><div class="rich-text"><p>Valuation.</p></div></div>');
  });

  it('follows the employers with what naming them means', () => {
    const html = renderToStaticMarkup(<LevelBandSection band={writtenLevelBands(content(), names).employers!} tone="paper" />);
    expect(html).toMatch(/^<section class="sec sec--paper" id="employers">/);
    expect(html).toContain('<h2 class="sec-title">Employers</h2>');
    expect(html).toMatch(new RegExp(`Banks\\.[\\s\\S]*<p class="trust__note">${EMPLOYERS_NOTE.replace(/[.;]/g, '\\$&')}</p>`));
    expect(EMPLOYERS_NOTE).toBe('Named for illustration only; not a ranking, endorsement or partnership.');
  });
});

describe('a band’s lead and links', () => {
  it('prints a lead beside the heading only when the band has one', () => {
    const band = { id: 'consultants', eyebrow: 'Consultants', title: 'Study abroad consultants', body: <p>Cards.</p> };
    const plain = renderToStaticMarkup(<LevelBandSection band={band} tone="paper" />);
    expect(plain).not.toContain('sec-lead');
    const led = renderToStaticMarkup(<LevelBandSection band={{ ...band, lead: 'Talk to a consultant.' }} tone="paper" />);
    expect(led).toContain('<p class="sec-lead">Talk to a consultant.</p>');
    expect(led.indexOf('sec-title')).toBeLessThan(led.indexOf('sec-lead'));
  });

  it('draws a row of links as the level chips are drawn, and nothing for none', () => {
    const html = renderToStaticMarkup(<LinkChips label="Plan your MBA" links={[{ href: '/universities', label: 'Browse universities' }, { href: '/study-abroad', label: 'Compare study destinations' }]} />);
    expect(html).toBe(
      '<nav class="specchips levelchips" aria-label="Plan your MBA"><ul class="specchips__row" role="list">'
      + '<li><a class="specchip" href="/universities">Browse universities</a></li>'
      + '<li><a class="specchip" href="/study-abroad">Compare study destinations</a></li></ul></nav>',
    );
    expect(renderToStaticMarkup(<LinkChips label="Plan your MBA" links={[]} />)).toBe('');
  });

  it('closes a band with one link, as “About …” does', () => {
    expect(renderToStaticMarkup(<MoreLink href="/subjects">All subjects</MoreLink>)).toBe(
      '<p class="levelmore__about"><a class="linkcta" href="/subjects">All subjects <span class="linkcta__arrow" aria-hidden="true">→</span></a></p>',
    );
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
