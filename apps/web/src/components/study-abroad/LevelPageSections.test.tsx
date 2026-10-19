import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SubjectLevelPageContent } from '@/lib/catalog';
import { bandTones, EMPLOYERS_NOTE, LevelBandSection, LinkChips, MoreLink, namedItems, writtenLevelBands } from './LevelPageSections';

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
    expect(html).toMatch(/^<section class="sec sec--white levelband" id="study-topics">/);
    expect(html).toContain('<h2 class="sec-title">What you may study</h2>');
    expect(html).toContain('<div class="prose"><div class="rich-text"><p>Valuation.</p></div></div>');
  });

  it('follows the employers with what naming them means', () => {
    const html = renderToStaticMarkup(<LevelBandSection band={writtenLevelBands(content(), names).employers!} tone="paper" />);
    expect(html).toMatch(/^<section class="sec sec--paper levelband" id="employers">/);
    expect(html).toContain('<h2 class="sec-title">Employers</h2>');
    expect(html).toMatch(new RegExp(`Banks\\.[\\s\\S]*<p class="trust__note">${EMPLOYERS_NOTE.replace(/[.;]/g, '\\$&')}</p>`));
    expect(EMPLOYERS_NOTE).toBe('Named for illustration only; not a ranking, endorsement or partnership.');
  });

  it('puts every written note beside its heading, and the questions under theirs', () => {
    const bands = writtenLevelBands(content(), names);
    expect(Object.fromEntries(Object.entries(bands).map(([key, band]) => [key, band?.layout]))).toEqual({
      overview: 'split', studyTopics: 'split', careers: 'split', industries: 'split',
      employers: 'split', admission: 'split', lookingAhead: 'split', faqs: undefined,
    });
    const html = renderToStaticMarkup(<LevelBandSection band={bands.overview!} tone="paper" />);
    expect(html).toContain(
      '<div class="sec-head sec-head--split"><div class="sec-head__aside"><p class="eyebrow">Overview</p><h2 class="sec-title">Why study an MBA in Finance?</h2></div>'
      + '<div><div class="levelband__body"><div class="prose"><div class="rich-text"><p>Why.</p></div></div></div></div></div>',
    );
  });

  it('numbers the careers and the topics as a list, and lists the employers by name', () => {
    const bands = writtenLevelBands(content({ careersNote: '<p>Where it leads.</p><ul><li>Analyst</li><li>Banker</li></ul>' }), names);
    const careers = renderToStaticMarkup(<LevelBandSection band={bands.careers!} tone="white" />);
    expect(careers).toContain('<div class="levellist"><div class="prose"><div class="rich-text"><p>Where it leads.</p><ul><li>Analyst</li><li>Banker</li></ul></div></div></div>');
    expect(renderToStaticMarkup(<LevelBandSection band={bands.studyTopics!} tone="white" />)).toContain('<div class="levellist"><div class="prose">');
    /* The note stays straight after the names: the e2e reads it as `.prose + p`. */
    expect(renderToStaticMarkup(<LevelBandSection band={bands.employers!} tone="paper" />)).toContain(
      `<div class="levellist levellist--names"><div class="prose"><div class="rich-text"><p>Banks.</p></div></div><p class="trust__note">${EMPLOYERS_NOTE}</p></div>`,
    );
  });

  it('draws each named industry as a card, and any other note as prose', () => {
    const cards = renderToStaticMarkup(<LevelBandSection
      band={writtenLevelBands(content({ industries: '<ul><li><strong>Banking &amp; insurance</strong>: Banks hire analysts.</li><li><strong>Retail</strong>: Shops run on data.</li></ul>' }), names).industries!}
      tone="white"
    />);
    expect(cards).toContain(
      '<ul class="levelsectors" role="list">'
      + '<li class="levelsector"><h3 class="levelsector__t">Banking &amp; insurance</h3><div class="rich-text levelsector__b"><p>Banks hire analysts.</p></div></li>'
      + '<li class="levelsector"><h3 class="levelsector__t">Retail</h3><div class="rich-text levelsector__b"><p>Shops run on data.</p></div></li></ul>',
    );
    expect(cards).not.toContain('class="prose"');
    const plain = renderToStaticMarkup(<LevelBandSection band={writtenLevelBands(content({ industries: 'Shipping, logistics and marine insurance.' }), names).industries!} tone="white" />);
    expect(plain).toContain('<div class="prose"><p class="rich-text" style="white-space:pre-line">Shipping, logistics and marine insurance.</p></div>');
    expect(plain).not.toContain('levelsectors');
  });
});

describe('a list of named items', () => {
  it('reads a bold name, before its colon or with the colon inside it', () => {
    expect(namedItems('<ul><li><strong>Banking</strong>: Banks hire.</li><li><b>Retail</b> \u2013 Shops hire.</li><li><strong>Health:</strong> Hospitals hire.</li></ul>')).toEqual([
      { name: 'Banking', line: 'Banks hire.' },
      { name: 'Retail', line: 'Shops hire.' },
      { name: 'Health', line: 'Hospitals hire.' },
    ]);
  });

  it('reads a plain "Name: line"', () => {
    expect(namedItems('<ul>\n  <li>Banking: Banks hire.</li>\n  <li>Retail: Shops <em>hire</em>.</li>\n</ul>')).toEqual([
      { name: 'Banking', line: 'Banks hire.' },
      { name: 'Retail', line: 'Shops <em>hire</em>.' },
    ]);
  });

  it('keeps an entity in a name as written, and no tag', () => {
    expect(namedItems('<ul><li><strong>R&amp;D <em>labs</em></strong>: Research.</li><li><strong>Q&amp;A</strong>: Testing.</li></ul>')).toEqual([
      { name: 'R&amp;D labs', line: 'Research.' },
      { name: 'Q&amp;A', line: 'Testing.' },
    ]);
  });

  it('is none unless every item of one flat list reads that way', () => {
    /* One item without a name. */
    expect(namedItems('<ul><li><strong>Banking</strong>: Banks hire.</li><li>Retail</li></ul>')).toBeNull();
    /* A name with nothing after it. */
    expect(namedItems('<ul><li><strong>Banking</strong>: Banks hire.</li><li><strong>Retail</strong>: <em> </em></li></ul>')).toBeNull();
    /* A paragraph, or a paragraph before the list. */
    expect(namedItems('<p>Banking: Banks hire.</p>')).toBeNull();
    expect(namedItems('<p>Sectors.</p><ul><li>Banking: Banks hire.</li><li>Retail: Shops hire.</li></ul>')).toBeNull();
    /* A list inside the list. */
    expect(namedItems('<ul><li>Banking: Banks hire.<ul><li>Retail: Shops hire.</li></ul></li><li>Health: Hospitals hire.</li></ul>')).toBeNull();
    /* A numbered list, a single item, and plain text. */
    expect(namedItems('<ol><li>Banking: Banks hire.</li><li>Retail: Shops hire.</li></ol>')).toBeNull();
    expect(namedItems('<ul><li>Banking: Banks hire.</li></ul>')).toBeNull();
    expect(namedItems('Shipping, logistics and marine insurance.')).toBeNull();
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

  it('puts a split or sparse band’s body beside its heading, and leaves any other band as it was', () => {
    const band = { id: 'more', eyebrow: 'Keep exploring', title: 'More on Finance', body: <p>Chips.</p> };
    expect(renderToStaticMarkup(<LevelBandSection band={band} tone="white" />)).toBe(
      '<section class="sec sec--white" id="more"><div class="wrap"><div class="sec-head sec-head--split"><div class="sec-head__aside">'
      + '<p class="eyebrow">Keep exploring</p><h2 class="sec-title">More on Finance</h2></div></div><p>Chips.</p></div></section>',
    );
    const beside = '<div class="sec-head sec-head--split"><div class="sec-head__aside"><p class="eyebrow">Keep exploring</p><h2 class="sec-title">More on Finance</h2></div>'
      + '<div><div class="levelband__body"><p>Chips.</p></div></div></div>';
    const sparse = renderToStaticMarkup(<LevelBandSection band={{ ...band, layout: 'sparse' }} tone="paper" />);
    expect(sparse).toMatch(/^<section class="sec sec--paper sec--sparse levelband" id="more"><div class="wrap">/);
    expect(sparse).toContain(beside);
    const split = renderToStaticMarkup(<LevelBandSection band={{ ...band, layout: 'split' }} tone="white" />);
    expect(split).toMatch(/^<section class="sec sec--white levelband" id="more"><div class="wrap">/);
    expect(split).toContain(beside);
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
