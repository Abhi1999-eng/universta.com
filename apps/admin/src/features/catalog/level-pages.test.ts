import { describe, expect, it } from 'vitest';
import {
  LEVEL_PAGE_MIN_FAQS,
  levelPageBytes,
  levelPageEditorHref,
  levelPageFaqBlank,
  levelPageFaqs,
  levelPagePayload,
  levelPagesAnchor,
  levelPageTitle,
  levelSourcesHint,
  ownerEditorHref,
  sameIds,
  searchGap,
} from './level-pages';
import { faqBlank, faqIssues, type FaqDraft } from './editorial/ContentBlocks';
import { blankUnifiedSeo } from '@/features/shared/UnifiedSeoFields';

const subject = { id: 'subject-1', name: 'Marine Sciences', slug: 'marine-sciences', status: 'PUBLISHED' };
const level = { id: 'lvl-ug', code: 'UG', name: "Bachelor's", slug: 'bachelors', description: null, status: 'ACTIVE' };
const blank = { intro: '', admissionNote: '', careersNote: '' };

describe('where level pages live', () => {
  it('addresses both owners and their card', () => {
    expect(ownerEditorHref('subject', 'subject-1')).toBe('/subjects/subject-1');
    expect(ownerEditorHref('specialization', 'spec-1')).toBe('/specializations/spec-1');
    expect(levelPageEditorHref('subject', 'subject-1', 'lvl-ug')).toBe('/subjects/subject-1/level-pages/lvl-ug');
    expect(levelPageEditorHref('specialization', 'spec-1', 'lvl-phd')).toBe('/specializations/spec-1/level-pages/lvl-phd');
    expect(levelPagesAnchor('subject')).toBe('subject-level-pages');
    expect(levelPagesAnchor('specialization')).toBe('specialization-level-pages');
  });

  it('names a page after its level and its field', () => {
    expect(levelPageTitle({ level, subject, specialization: null })).toBe("Bachelor's in Marine Sciences");
    expect(levelPageTitle({ level, subject, specialization: { id: 'spec-1', name: 'Marine Biology', slug: 'marine-biology', status: 'DRAFT' } })).toBe(
      "Bachelor's in Marine Biology",
    );
  });

  it('says why a level is offered, in a fixed order', () => {
    expect(levelSourcesHint(['COURSES', 'TICKED'])).toBe('Ticked here · Has published courses');
    expect(levelSourcesHint(['SPECIALIZATION'])).toBe('From a specialization');
    expect(levelSourcesHint([])).toBe('');
  });
});

describe('searchGap', () => {
  it('names what a page still lacks to be indexed on its own words', () => {
    expect(LEVEL_PAGE_MIN_FAQS).toBe(3);
    expect(searchGap(false, 1)).toEqual(['an intro', '2 more FAQs']);
    expect(searchGap(true, 2)).toEqual(['1 more FAQ']);
    expect(searchGap(true, 3)).toEqual([]);
    expect(searchGap(true, 7)).toEqual([]);
  });
});

describe('sameIds', () => {
  it('ignores order and repeats', () => {
    expect(sameIds(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameIds(['a', 'a'], ['a'])).toBe(true);
    expect(sameIds(['a'], ['a', 'b'])).toBe(false);
    expect(sameIds([], [])).toBe(true);
  });
});

const row = (question: string, displayOrder: string): FaqDraft => ({ question, answer: `${question} yes`, status: 'ACTIVE', displayOrder });
const order = (faqs: FaqDraft[]) => levelPageFaqs(faqs).map((faq) => [faq.question, faq.displayOrder]);

/* The API sorts FAQs by display order and then by id, and each save gives
   them new ids, so FAQs sent with the same number come back in any order. */
describe('levelPageFaqs', () => {
  it('keeps a typed display order, 0 included, and numbers the FAQs 0..n-1', () => {
    expect(order([row('A', '5'), row('B', '0'), row('C', '12')])).toEqual([['B', 0], ['A', 1], ['C', 2]]);
  });

  it('reads a blank display order as the row’s place on screen', () => {
    expect(order([row('A', ''), row('B', ''), row('C', '')])).toEqual([['A', 0], ['B', 1], ['C', 2]]);
    expect(order([row('A', '2'), row('B', ''), row('C', '0')])).toEqual([['C', 0], ['B', 1], ['A', 2]]);
  });

  it('breaks a tie by the order on screen, so no two FAQs share a number', () => {
    /* Saved as 0, 1, 2; the first removed and a new one added below. */
    expect(order([row('B', '1'), row('C', '2'), { ...levelPageFaqBlank(), question: 'D', answer: 'D yes' }])).toEqual([['B', 0], ['C', 1], ['D', 2]]);
    expect(order([row('A', '3'), row('B', '3'), row('C', '3')])).toEqual([['A', 0], ['B', 1], ['C', 2]]);
  });

  it('counts only the rows that will be sent', () => {
    expect(order([levelPageFaqBlank(), row('A', ''), faqBlank(), row('B', '')])).toEqual([['A', 0], ['B', 1]]);
  });

  it('starts a new FAQ with a blank order, which only the level page accepts', () => {
    expect(levelPageFaqBlank()).toEqual({ ...faqBlank(), displayOrder: '' });
    const written = { ...levelPageFaqBlank(), question: 'Q?', answer: 'A.' };
    expect(faqIssues([written], { blankOrder: true })).toEqual([]);
    expect(faqIssues([written])).toEqual(['FAQ 1: display order must be a whole number.']);
    expect(faqIssues([{ ...written, displayOrder: '-1' }], { blankOrder: true })).toEqual(['FAQ 1: display order must be a whole number.']);
  });
});

describe('levelPagePayload', () => {
  it('sends a first save with no FAQ ids, blank SEO as null and "no page yet" as the version', () => {
    const payload = levelPagePayload({
      content: { intro: '<p><br></p>', admissionNote: ' <p>Grades.</p> ', careersNote: '<p>&nbsp;</p>' },
      faqs: [faqBlank()],
      seo: blankUnifiedSeo,
      intent: 'draft',
      page: null,
    });
    expect(payload).toEqual({
      intro: '',
      admissionNote: '<p>Grades.</p>',
      careersNote: '',
      status: 'DRAFT',
      faqs: [],
      seo: null,
      expectedUpdatedAt: null,
    });
  });

  it('keeps the written FAQs in order, without their ids, and sends the page version', () => {
    const payload = levelPagePayload({
      content: blank,
      faqs: [
        { id: 'faq-1', updatedAt: 'f1', question: ' First? ', answer: ' Yes. ', status: 'ACTIVE', displayOrder: '0' },
        faqBlank(),
        { question: 'Second?', answer: 'No.', status: 'INACTIVE', displayOrder: '0' },
        { question: 'Third?', answer: 'Maybe.', status: 'ACTIVE', displayOrder: '7' },
      ],
      seo: blankUnifiedSeo,
      intent: 'publish',
      page: { updatedAt: '2026-10-17T10:00:00.000Z' },
    });
    expect(payload.status).toBe('PUBLISHED');
    expect(payload.expectedUpdatedAt).toBe('2026-10-17T10:00:00.000Z');
    expect(payload.faqs).toEqual([
      { question: 'First?', answer: 'Yes.', status: 'ACTIVE', displayOrder: 0 },
      { question: 'Second?', answer: 'No.', status: 'INACTIVE', displayOrder: 1 },
      { question: 'Third?', answer: 'Maybe.', status: 'ACTIVE', displayOrder: 2 },
    ]);
    expect(JSON.stringify(payload)).not.toContain('faq-1');
  });

  it('sends the SEO record once anything in it is written', () => {
    const payload = levelPagePayload({
      content: blank,
      faqs: [],
      seo: { ...blankUnifiedSeo, seoTitle: ' Bachelor’s in Marine Sciences ', metaDescription: 'Study the sea.', robotsFollow: false },
      intent: 'draft',
      page: null,
    });
    expect(payload.seo).toMatchObject({ seoTitle: 'Bachelor’s in Marine Sciences', metaDescription: 'Study the sea.', robotsIndex: true, robotsFollow: false });
    expect(payload.seo).not.toHaveProperty('expectedUpdatedAt');
  });

  it('sends the FAQs in the order levelPageFaqs gives them', () => {
    const faqs = [row('B', '1'), row('A', '0')];
    expect(levelPagePayload({ content: blank, faqs, seo: blankUnifiedSeo, intent: 'draft', page: null }).faqs).toEqual(levelPageFaqs(faqs));
  });

  it('measures the body in bytes, as the proxy does', () => {
    expect(levelPageBytes({ a: 'é' })).toBe(JSON.stringify({ a: 'é' }).length + 1);
  });
});
