import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LevelPageForm } from './LevelPageForm';
import type { LevelPageDetail } from './catalog.types';
import { clearFlash, peekFlash } from '@/features/shared/Flash';

/**
 * The editor for one level page, such as /subjects/marine-sciences/bachelors.
 * Everything on it is saved in one PUT under one version: the text, the
 * status, the whole FAQ list and the SEO. The version the API hands back is
 * the one the next save is checked against.
 */

const push = vi.fn();
const mocks = vi.hoisted(() => ({
  getLevelPage: vi.fn(),
  saveLevelPage: vi.fn(),
  listEditorialMedia: vi.fn(),
}));
const navigated = vi.hoisted(() => vi.fn());
vi.mock('./catalog-client', () => mocks);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/' }));
/* Behaves as Next's link does: the click handler runs first, and a handler
   that prevents the default stops the navigation. */
vi.mock('next/link', () => ({
  default: ({ children, href, onClick, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a
      {...rest}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) navigated(href);
        event.preventDefault();
      }}
    >
      {children}
    </a>
  ),
}));

type Page = NonNullable<LevelPageDetail['page']>;
type Payload = { status: 'DRAFT' | 'PUBLISHED'; intro: string; admissionNote: string; careersNote: string; faqs: Array<{ question: string; answer: string; status: string; displayOrder: number }>; seo: Record<string, unknown> | null; expectedUpdatedAt: string | null };

const subject = { id: 'subject-1', name: 'Marine Sciences', slug: 'marine-sciences', status: 'PUBLISHED' };
const ug = { id: 'lvl-ug', code: 'UG', name: "Bachelor's", slug: 'bachelors', description: 'Three or four years of first-degree study.', status: 'ACTIVE' };

function detail(page: Page | null, overrides: Partial<LevelPageDetail> = {}): LevelPageDetail {
  return { subject, specialization: null, level: ug, offered: true, sources: ['TICKED'], path: '/subjects/marine-sciences/bachelors', page, ...overrides };
}
function stored(overrides: Partial<Page> = {}): Page {
  return { id: 'page-1', status: 'DRAFT', intro: null, admissionNote: null, careersNote: null, faqs: [], seo: null, searchReady: false, createdAt: 'c', updatedAt: 'v1', ...overrides };
}
/* Stored ids are UUIDs; ones shaped like the FAQ card's "faq-<index>" key
   for a new row would clash with it once a row is added. */
const faq = (id: string, question: string, displayOrder: number) => ({ id, question, answer: `${question} Yes.`, status: 'ACTIVE', displayOrder, updatedAt: 'f' });
const seoRecord = {
  id: 'seo-1', ownerType: 'SUBJECT_LEVEL_PAGE', ownerId: 'page-1', seoTitle: "Bachelor's in Marine Sciences", metaDescription: 'Study the sea.',
  canonicalUrl: null, focusKeyword: null, ogTitle: null, ogDescription: null, ogMediaId: null, twitterTitle: null, twitterDescription: null, twitterMediaId: null,
  robotsIndex: true, robotsFollow: true, schemaJson: null, hreflangJson: null, ogMedia: null, twitterMedia: null, createdAt: 'c', updatedAt: 'u',
};

/** Answers a save the way the API does: the page as kept, with a new version. */
let version = 1;
function answerSaves() {
  mocks.saveLevelPage.mockImplementation(async (_owner: string, _id: string, _level: string, payload: Payload) => {
    version += 1;
    return {
      data: detail(stored({
        status: payload.status,
        intro: payload.intro || null,
        admissionNote: payload.admissionNote || null,
        careersNote: payload.careersNote || null,
        faqs: payload.faqs.map((row, index) => ({ id: `saved-${version}-${index}`, ...row, updatedAt: 'f' })),
        seo: payload.seo ? { ...seoRecord, ...payload.seo } : null,
        updatedAt: `v${version}`,
      })),
      meta: null,
    };
  });
}

const sentPayload = (call = 0) => mocks.saveLevelPage.mock.calls[call][3] as Payload;

async function write(label: string, html: string) {
  const box = await screen.findByRole('textbox', { name: label });
  box.innerHTML = html;
  fireEvent.input(box);
}

beforeEach(() => {
  clearFlash();
  push.mockReset();
  navigated.mockReset();
  version = 1;
  mocks.getLevelPage.mockResolvedValue({ data: detail(null), meta: null });
  mocks.listEditorialMedia.mockResolvedValue({ data: [], meta: null });
  answerSaves();
});

describe('opening a page', () => {
  it('opens a page not written yet, with one blank FAQ and the level’s own line quoted', async () => {
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    expect(await screen.findByRole('heading', { name: "Bachelor's in Marine Sciences" })).toBeInTheDocument();
    expect(mocks.getLevelPage).toHaveBeenCalledWith('subject', 'subject-1', 'lvl-ug');
    expect(screen.getByText('NOT WRITTEN')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Marine Sciences' })).toHaveAttribute('href', '/subjects/subject-1#subject-level-pages');
    expect(screen.getByRole('heading', { name: 'FAQ 1' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'FAQ 2' })).toBeNull();
    expect(screen.getByText(/Three or four years of first-degree study\./)).toBeInTheDocument();
    expect(await screen.findByRole('textbox', { name: 'Intro' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Admission note' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Careers note' })).toBeInTheDocument();
    for (const name of ['Page content', 'FAQs', 'SEO']) expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    expect(screen.getByText('Leave blank to use the Study level pages template under SEO management > Bulk SEO.')).toBeInTheDocument();
    expect(screen.getByText(/it still needs an intro and 3 more FAQs/)).toBeInTheDocument();
  });

  it('opens a specialization’s page from the specialization', async () => {
    mocks.getLevelPage.mockResolvedValue({
      data: detail(null, {
        specialization: { id: 'spec-1', name: 'Marine Biology', slug: 'marine-biology', status: 'PUBLISHED' },
        level: { ...ug, id: 'lvl-phd', code: 'PHD', name: 'PhD', slug: 'phd', description: null },
        path: '/subjects/marine-sciences/marine-biology/phd',
      }),
      meta: null,
    });
    render(<LevelPageForm owner="specialization" ownerId="spec-1" levelId="lvl-phd" />);
    expect(await screen.findByRole('heading', { name: 'PhD in Marine Biology' })).toBeInTheDocument();
    expect(mocks.getLevelPage).toHaveBeenCalledWith('specialization', 'spec-1', 'lvl-phd');
    expect(screen.getByRole('link', { name: '← Marine Biology' })).toHaveAttribute('href', '/specializations/spec-1#specialization-level-pages');
    expect(screen.getByRole('link', { name: /View on site/ }).getAttribute('href')).toMatch(/\/subjects\/marine-sciences\/marine-biology\/phd$/);
  });

  it('says why it could not open, with the way back', async () => {
    mocks.getLevelPage.mockRejectedValue(Object.assign(new Error('Course level not found'), { code: 'COURSE_LEVEL_NOT_FOUND' }));
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="gone" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Course level not found');
    expect(screen.getByRole('link', { name: '← Back to the subject' })).toHaveAttribute('href', '/subjects/subject-1');
  });

  it('opens a page whose level is no longer offered read-only, with no way to save it', async () => {
    mocks.getLevelPage.mockResolvedValue({ data: detail(stored({ intro: '<p>Kept.</p>' }), { offered: false, sources: [] }), meta: null });
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    expect(await screen.findByRole('alert')).toHaveTextContent("Bachelor's is not offered for Marine Sciences now");
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Question' })).toBeDisabled();
    expect(await screen.findByRole('textbox', { name: 'Intro' })).toHaveAttribute('contenteditable', 'false');
    expect(screen.queryByRole('link', { name: /View on site/ })).toBeNull();
  });
});

describe('saving', () => {
  it('saves a first draft as "no page yet", stays on the page, and checks the next save against the version it got back', async () => {
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await write('Intro', '<p>Oceans, coasts and the life in them.</p>');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(mocks.saveLevelPage).toHaveBeenCalledTimes(1));
    expect(mocks.saveLevelPage.mock.calls[0].slice(0, 3)).toEqual(['subject', 'subject-1', 'lvl-ug']);
    expect(sentPayload()).toEqual({
      intro: '<p>Oceans, coasts and the life in them.</p>',
      admissionNote: '',
      careersNote: '',
      status: 'DRAFT',
      faqs: [],
      seo: null,
      expectedUpdatedAt: null,
    });
    expect(await screen.findByText('Draft saved. It stays off the site until you publish it.')).toBeInTheDocument();
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.saveLevelPage).toHaveBeenCalledTimes(2));
    expect(sentPayload(1).expectedUpdatedAt).toBe('v2');
  });

  it('publishes, hands a green confirmation over and goes back to the Level pages card', async () => {
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await write('Intro', '<p>Oceans.</p>');
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/subjects/subject-1#subject-level-pages'));
    expect(sentPayload().status).toBe('PUBLISHED');
    expect(peekFlash()).toMatchObject({ tone: 'success', message: "Bachelor's in Marine Sciences published successfully." });
  });

  it('will not publish a page with nothing written on it', async () => {
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await screen.findByRole('textbox', { name: 'Intro' });
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Write an intro, a note or an FAQ before publishing this level page.')).toBeInTheDocument();
    expect(mocks.saveLevelPage).not.toHaveBeenCalled();
  });

  it('sends the kept FAQs whole, without ids, against the stored version', async () => {
    mocks.getLevelPage.mockResolvedValue({
      data: detail(stored({ faqs: [faq('faq-1', 'Is it in English?', 0), faq('faq-2', 'Is there a field trip?', 1), faq('faq-3', 'Can I start in spring?', 2)], seo: seoRecord })),
      meta: null,
    });
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    expect(await screen.findByDisplayValue('Is it in English?')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'SEO title' })).toHaveValue("Bachelor's in Marine Sciences");

    const second = screen.getAllByRole('textbox', { name: 'Question' })[1];
    await user.clear(second);
    await user.type(second, 'Is there a sea voyage?');
    const thirdCard = screen.getByRole('heading', { name: 'FAQ 3' }).closest('.p-panel') as HTMLElement;
    await user.click(within(thirdCard).getByRole('button', { name: 'Remove' }));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(mocks.saveLevelPage).toHaveBeenCalledTimes(1));
    const payload = sentPayload();
    expect(payload.expectedUpdatedAt).toBe('v1');
    expect(payload.faqs).toEqual([
      { question: 'Is it in English?', answer: 'Is it in English? Yes.', status: 'ACTIVE', displayOrder: 0 },
      { question: 'Is there a sea voyage?', answer: 'Is there a field trip? Yes.', status: 'ACTIVE', displayOrder: 1 },
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/faq-\d/);
    expect(payload.seo).toMatchObject({ seoTitle: "Bachelor's in Marine Sciences", metaDescription: 'Study the sea.' });
  });

  /* The API sorts FAQs by display order and then by id, and every save
     gives them new ids, so a tie would come back in any order. */
  it('adds a new FAQ at the bottom and sends no tie, after one above it was removed', async () => {
    mocks.getLevelPage.mockResolvedValue({
      data: detail(stored({ faqs: [faq('stored-1', 'Is it in English?', 0), faq('stored-2', 'Is there a field trip?', 1), faq('stored-3', 'Can I start in spring?', 2)] })),
      meta: null,
    });
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await screen.findByDisplayValue('Is it in English?');
    const firstCard = screen.getByRole('heading', { name: 'FAQ 1' }).closest('.p-panel') as HTMLElement;
    await user.click(within(firstCard).getByRole('button', { name: 'Remove' }));
    await user.click(screen.getByRole('button', { name: '+ Add another FAQ' }));
    expect(screen.getAllByRole('spinbutton', { name: 'Display order' })[2]).toHaveValue(null);
    await user.type(screen.getAllByRole('textbox', { name: 'Question' })[2], 'Is there a scholarship?');
    await user.type(screen.getAllByRole('textbox', { name: 'Answer' })[2], 'Some.');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(mocks.saveLevelPage).toHaveBeenCalledTimes(1));
    expect(sentPayload().faqs.map((row) => [row.question, row.displayOrder])).toEqual([
      ['Is there a field trip?', 0],
      ['Can I start in spring?', 1],
      ['Is there a scholarship?', 2],
    ]);
  });

  it('keeps a display order of 0 typed on a later FAQ, and moves it to the top', async () => {
    mocks.getLevelPage.mockResolvedValue({
      data: detail(stored({ faqs: [faq('stored-1', 'Is it in English?', 0), faq('stored-2', 'Is there a field trip?', 1)] })),
      meta: null,
    });
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await screen.findByDisplayValue('Is it in English?');
    await user.click(screen.getByRole('button', { name: '+ Add another FAQ' }));
    await user.type(screen.getAllByRole('textbox', { name: 'Question' })[2], 'Can I start in spring?');
    await user.type(screen.getAllByRole('textbox', { name: 'Answer' })[2], 'Yes.');
    await user.type(screen.getAllByRole('spinbutton', { name: 'Display order' })[2], '0');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(mocks.saveLevelPage).toHaveBeenCalledTimes(1));
    expect(sentPayload().faqs.map((row) => [row.question, row.displayOrder])).toEqual([
      ['Is it in English?', 0],
      ['Can I start in spring?', 1],
      ['Is there a field trip?', 2],
    ]);
    /* Read back as kept: the editor shows the order the page will. */
    await waitFor(() => expect(screen.getAllByRole('textbox', { name: 'Question' }).map((box) => (box as HTMLInputElement).value)).toEqual([
      'Is it in English?',
      'Can I start in spring?',
      'Is there a field trip?',
    ]));
  });

  it('removes stored SEO by sending null once its fields are cleared', async () => {
    mocks.getLevelPage.mockResolvedValue({ data: detail(stored({ intro: '<p>Oceans.</p>', seo: seoRecord })), meta: null });
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await user.clear(await screen.findByRole('textbox', { name: 'SEO title' }));
    await user.clear(screen.getByRole('textbox', { name: 'Meta description' }));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.saveLevelPage).toHaveBeenCalledTimes(1));
    expect(sentPayload().seo).toBeNull();
  });

  it('moves a published page back to draft', async () => {
    mocks.getLevelPage.mockResolvedValue({ data: detail(stored({ status: 'PUBLISHED', intro: '<p>Oceans.</p>' })), meta: null });
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await user.click(await screen.findByRole('button', { name: 'Move to draft' }));
    await waitFor(() => expect(mocks.saveLevelPage).toHaveBeenCalledTimes(1));
    expect(sentPayload().status).toBe('DRAFT');
    expect(await screen.findByText('Moved to draft.')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  /* Enter in a text field would click the form's first submit button,
     which on a published page is Move to draft. */
  it('saves nothing when Enter is pressed in a text field of a published page', async () => {
    mocks.getLevelPage.mockResolvedValue({ data: detail(stored({ status: 'PUBLISHED', intro: '<p>Oceans.</p>', faqs: [faq('faq-1', 'Is it in English?', 0)], seo: seoRecord })), meta: null });
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await user.type(await screen.findByRole('textbox', { name: 'SEO title' }), ' 2027{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'Question' }), '{Enter}');
    await user.type(screen.getByRole('spinbutton', { name: 'Display order' }), '{Enter}');
    expect(mocks.saveLevelPage).not.toHaveBeenCalled();
    expect(screen.queryByText('Moved to draft.')).toBeNull();
    expect(screen.getByText('PUBLISHED')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(mocks.saveLevelPage).toHaveBeenCalledTimes(1));
    expect(sentPayload().status).toBe('PUBLISHED');
  });

  it('keeps what was typed when the page changed in another session', async () => {
    mocks.saveLevelPage.mockRejectedValue(Object.assign(new Error('This level page changed in another session. Reload before saving'), { code: 'LEVEL_PAGE_STALE_VERSION', status: 409 }));
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await write('Intro', '<p>Typed here.</p>');
    const question = screen.getByRole('textbox', { name: 'Question' });
    await user.type(question, 'Kept?');
    await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'Yes.');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('This level page changed in another session. Reload before saving')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Question' })).toHaveValue('Kept?');
    expect(screen.getByRole('textbox', { name: 'Intro' })).toHaveAttribute('data-rte-value', '<p>Typed here.</p>');
  });
});

describe('leaving with unsaved writing', () => {
  /* The back link and Cancel navigate inside the app, where the browser's
     leave-page warning never fires. */
  it('asks before the back link drops unsaved writing, and stays when the answer is no', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await user.type(await screen.findByRole('textbox', { name: 'Question' }), 'Unsaved?');
    await user.click(screen.getByRole('link', { name: '← Marine Sciences' }));
    expect(confirm).toHaveBeenCalledWith('Leave this level page without saving your changes?');
    expect(navigated).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Question' })).toHaveValue('Unsaved?');

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('link', { name: '← Marine Sciences' }));
    expect(navigated).toHaveBeenCalledWith('/subjects/subject-1#subject-level-pages');
  });

  it('asks before Cancel drops unsaved writing too', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await user.type(await screen.findByRole('textbox', { name: 'Question' }), 'Unsaved?');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(confirm).toHaveBeenCalledWith('Leave this level page without saving your changes?');
    expect(navigated).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(navigated).toHaveBeenCalledWith('/subjects/subject-1#subject-level-pages');
  });

  it('leaves without asking when nothing is unsaved', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await screen.findByRole('textbox', { name: 'Intro' });
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    await user.click(screen.getByRole('link', { name: '← Marine Sciences' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(navigated).toHaveBeenCalledTimes(2);
  });
});

describe('checks before saving', () => {
  /* A started FAQ and started SEO mark their other half required, so the
     browser holds the form back before the editor's own checks run. */
  it('asks for both halves of an FAQ', async () => {
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await user.type(await screen.findByRole('textbox', { name: 'Answer' }), 'An answer with no question.');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(screen.getByRole('textbox', { name: 'Question' })).toBeInvalid();
    expect(mocks.saveLevelPage).not.toHaveBeenCalled();
  });

  it('asks for the meta description once the SEO title is written', async () => {
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await user.type(await screen.findByRole('textbox', { name: 'SEO title' }), "Bachelor's in Marine Sciences");
    expect(screen.getByText('SEO title and Meta description are required before this level page can be saved.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(screen.getByRole('textbox', { name: 'Meta description' })).toBeInvalid();
    expect(mocks.saveLevelPage).not.toHaveBeenCalled();
  });

  /* What the browser cannot see: a display order that is not a whole number
     slips past a number field with no step, and the editor names it. */
  it('names an FAQ the browser lets through', async () => {
    mocks.getLevelPage.mockResolvedValue({ data: detail(stored({ faqs: [{ ...faq('faq-1', 'Is it in English?', 0), displayOrder: -1 }] })), meta: null });
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await screen.findByDisplayValue('Is it in English?');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('FAQ 1: display order must be a whole number.')).toBeInTheDocument();
    expect(mocks.saveLevelPage).not.toHaveBeenCalled();
  });

  it('takes a cleared display order as the FAQ’s place on screen', async () => {
    mocks.getLevelPage.mockResolvedValue({
      data: detail(stored({ faqs: [faq('stored-1', 'Is it in English?', 0), faq('stored-2', 'Is there a field trip?', 1)] })),
      meta: null,
    });
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await screen.findByDisplayValue('Is it in English?');
    await user.clear(screen.getAllByRole('spinbutton', { name: 'Display order' })[1]);
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.saveLevelPage).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/display order must be a whole number/)).toBeNull();
    expect(sentPayload().faqs.map((row) => [row.question, row.displayOrder])).toEqual([['Is it in English?', 0], ['Is there a field trip?', 1]]);
  });

  it('will not drop an unticked Robots index without a title and description to keep it with', async () => {
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await user.click(await screen.findByRole('checkbox', { name: 'Robots index' }));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('To keep this page out of search engines, also write its SEO title and meta description.')).toBeInTheDocument();
    expect(mocks.saveLevelPage).not.toHaveBeenCalled();
  });

  it('stops a page too long to send in one go', async () => {
    const user = userEvent.setup();
    render(<LevelPageForm owner="subject" ownerId="subject-1" levelId="lvl-ug" />);
    await write('Intro', `<p>${'a'.repeat(61_000)}</p>`);
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('This page is too long to save in one go. Shorten the intro, the notes or the longest answers.')).toBeInTheDocument();
    expect(mocks.saveLevelPage).not.toHaveBeenCalled();
  });
});
