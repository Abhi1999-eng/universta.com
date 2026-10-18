import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpecializationForm } from './SpecializationForm';
import { clearFlash, peekFlash } from '@/features/shared/Flash';

/**
 * How a specialization's editor saves: the record first, then its sections,
 * FAQs, destinations, SEO and status, each a request of its own. Any of the
 * later ones can fail after the record exists, and the retry has to update
 * what is already there rather than create it again.
 */

const push = vi.fn();
const replace = vi.fn();
const mocks = vi.hoisted(() => ({
  createSpecializationFaq: vi.fn(),
  createSpecializationSection: vi.fn(),
  createSubSubject: vi.fn(),
  deleteSpecializationFaq: vi.fn(),
  deleteSpecializationSection: vi.fn(),
  deleteSpecializationSeo: vi.fn(),
  getSpecialization: vi.fn(),
  getSpecializationCountries: vi.fn(),
  getSubjectCountries: vi.fn(),
  getSpecializationSeo: vi.fn(),
  listAllSubjects: vi.fn(),
  listCountries: vi.fn(),
  listCourseLevels: vi.fn(),
  listEditorialMedia: vi.fn(),
  listEvery: vi.fn(),
  saveSpecializationCountries: vi.fn(),
  listSpecializationFaqs: vi.fn(),
  listSpecializationSections: vi.fn(),
  publishSubSubject: vi.fn(),
  saveSpecializationSeo: vi.fn(),
  unpublishSubSubject: vi.fn(),
  updateSpecializationFaq: vi.fn(),
  updateSpecializationSection: vi.fn(),
  updateSubSubject: vi.fn(),
  listLevelPages: vi.fn(),
  deleteLevelPage: vi.fn(),
}));
vi.mock('./catalog-client', () => mocks);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/' }));
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a {...rest} href={href}>{children}</a>
  ),
}));

const specialization = (patch: Record<string, unknown> = {}) => ({
  id: 'spec-1',
  subject: { id: 'subject-1', name: 'Marine Sciences', slug: 'marine-sciences', status: 'PUBLISHED' },
  name: 'Marine Biology',
  slug: 'marine-biology',
  shortDescription: 'Life in the ocean.',
  overview: null,
  iconMedia: null,
  listingMedia: null,
  featured: false,
  displayOrder: 0,
  courseLevels: [],
  impliedCourseLevels: [],
  status: 'DRAFT',
  publishedAt: null,
  createdAt: 'c',
  updatedAt: 'spec-v1',
  ...patch,
});
const faqRecord = (id: string, question: string, updatedAt = `${id}-v1`) => ({ id, question, answer: 'Yes.', status: 'ACTIVE', displayOrder: 0, updatedAt });
const seoRow = (patch: Record<string, unknown> = {}) => ({
  id: 'seo-1', ownerType: 'SUB_SUBJECT', ownerId: 'spec-1', seoTitle: null, metaDescription: null, canonicalUrl: null, focusKeyword: null, ogTitle: null, ogDescription: null, ogMediaId: null, twitterTitle: null, twitterDescription: null, twitterMediaId: null, robotsIndex: true, robotsFollow: true, schemaJson: null, hreflangJson: null, ogMedia: null, twitterMedia: null, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  ...patch,
});
const refusal = (message: string, code: string, status = 422) => Object.assign(new Error(message), { code, status, details: null });
const phd = { id: 'lvl-phd', code: 'PHD', name: 'PhD', description: null, educationOrder: 6, displayOrder: 0, status: 'ACTIVE', createdAt: 'c', updatedAt: 'u' };
const phdTick = { id: 'lvl-phd', name: 'PhD', code: 'PHD' };
/* The PhD row of the Level pages card as the API lists it. */
const phdRow = {
  level: { id: 'lvl-phd', code: 'PHD', name: 'PhD', slug: 'phd', description: null, status: 'ACTIVE' },
  offered: true,
  sources: ['TICKED'],
  path: '/subjects/marine-sciences/marine-biology/phd',
  page: null,
};
const notSavedHint = /Rows marked “Not saved yet” follow your study level ticks\./;
/* One level's row on the card; the ticks above carry the same names. */
const cardRow = (name: string) => document.querySelector<HTMLElement>(`[data-level-row="${name}"]`);

beforeEach(() => {
  clearFlash();
  mocks.listEditorialMedia.mockResolvedValue({ data: [], meta: null });
  mocks.listAllSubjects.mockResolvedValue([{ id: 'subject-1', name: 'Marine Sciences', slug: 'marine-sciences', status: 'PUBLISHED' }]);
  mocks.listCourseLevels.mockResolvedValue({ data: [], meta: null });
  mocks.listEvery.mockResolvedValue([]);
  mocks.getSpecialization.mockResolvedValue({ data: specialization() });
  mocks.getSpecializationSeo.mockResolvedValue({ data: null });
  mocks.listSpecializationSections.mockResolvedValue({ data: [] });
  mocks.listSpecializationFaqs.mockResolvedValue({ data: [] });
  mocks.getSpecializationCountries.mockResolvedValue({ data: [] });
  mocks.getSubjectCountries.mockResolvedValue({ data: [] });
  mocks.saveSpecializationCountries.mockResolvedValue({ data: [] });
  mocks.updateSubSubject.mockResolvedValue({ data: specialization({ updatedAt: 'spec-v2' }) });
  mocks.publishSubSubject.mockResolvedValue({ data: specialization({ status: 'PUBLISHED', updatedAt: 'spec-v3' }) });
  mocks.unpublishSubSubject.mockResolvedValue({ data: specialization({ updatedAt: 'spec-v4' }) });
  mocks.listLevelPages.mockResolvedValue({ data: [], meta: null });
});

async function startNew(user: ReturnType<typeof userEvent.setup>) {
  const view = render(<SpecializationForm />);
  await screen.findByRole('button', { name: 'Publish' });
  await user.selectOptions(view.container.querySelector<HTMLSelectElement>('#specialization-subject')!, 'subject-1');
  await user.type(view.container.querySelector<HTMLInputElement>('#specialization-name')!, 'Marine Biology');
  return view;
}

describe('specialization editor save flow', () => {
  /* Enter in a text field clicked the form's first submit button -- Move to
     draft, on a live specialization. */
  it('saves nothing when Enter is pressed in a text field of a published specialization', async () => {
    mocks.getSpecialization.mockResolvedValue({ data: specialization({ status: 'PUBLISHED' }) });
    mocks.updateSubSubject.mockResolvedValue({ data: specialization({ status: 'PUBLISHED', updatedAt: 'spec-v2' }) });
    const user = userEvent.setup();
    const { container } = render(<SpecializationForm id="spec-1" />);
    await screen.findByRole('button', { name: 'Move to draft' });

    await user.type(container.querySelector<HTMLInputElement>('#specialization-name')!, ' II{Enter}');
    await user.type(container.querySelector<HTMLInputElement>('#specialization-slug')!, '{Enter}');
    await user.type(screen.getByRole('textbox', { name: /^Question/ }), '{Enter}');
    expect(mocks.updateSubSubject).not.toHaveBeenCalled();
    expect(mocks.unpublishSubSubject).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/specializations'));
    expect(mocks.updateSubSubject.mock.calls[0][2]).toMatchObject({ name: 'Marine Biology II' });
    expect(mocks.unpublishSubSubject).not.toHaveBeenCalled();
  });

  /* Publishing a new specialization under a subject that is not ready is
     refused after the record exists. The form used to stay a create: the
     retry was refused on its own slug and a hidden draft sat in the list. */
  it('adopts a new specialization the moment it is created, so the retry updates it', async () => {
    const addressBar = vi.spyOn(window.history, 'replaceState');
    mocks.createSubSubject.mockResolvedValue({ data: specialization({ id: 'spec-new', updatedAt: 'new-v1' }) });
    mocks.publishSubSubject.mockRejectedValueOnce(refusal('Complete Sub-Subject fields before publishing', 'SUB_SUBJECT_NOT_READY'));
    mocks.getSpecialization.mockResolvedValue({ data: specialization({ id: 'spec-new', updatedAt: 'new-v2' }) });
    mocks.updateSubSubject.mockResolvedValue({ data: specialization({ id: 'spec-new', updatedAt: 'new-v3' }) });
    const user = userEvent.setup();
    await startNew(user);
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    expect(await screen.findByText('Complete Sub-Subject fields before publishing')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edit specialization' })).toBeInTheDocument();
    expect(addressBar).toHaveBeenCalledWith(null, '', '/specializations/spec-new');
    expect(replace).not.toHaveBeenCalled();
    expect(mocks.getSpecialization).toHaveBeenCalledWith('spec-new');
    /* Nothing left the page, so the fields are free for the retry. */
    expect(screen.getByRole('textbox', { name: /^Name/ })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Publish' }));
    /* Still made in this session: the list replaces the adopted entry. */
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/specializations'));
    expect(push).not.toHaveBeenCalled();
    expect(mocks.createSubSubject).toHaveBeenCalledTimes(1);
    expect(mocks.updateSubSubject).toHaveBeenCalledTimes(1);
    expect(mocks.updateSubSubject.mock.calls[0].slice(0, 2)).toEqual(['subject-1', 'spec-new']);
    expect(mocks.updateSubSubject.mock.calls[0][2]).toMatchObject({ expectedUpdatedAt: 'new-v2', slug: 'marine-biology' });
  });

  /* The adopted entry holds the Create route under the record's address.
     Pushing the list past it left Back on a blank Create form there. */
  it('replaces the adopted history entry when a new specialization is published', async () => {
    mocks.createSubSubject.mockResolvedValue({ data: specialization({ id: 'spec-new', updatedAt: 'new-v1' }) });
    const user = userEvent.setup();
    await startNew(user);
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/specializations'));
    expect(push).not.toHaveBeenCalled();
    expect(mocks.publishSubSubject).toHaveBeenCalledWith('subject-1', 'spec-new', 'new-v1');
  });

  /* Once created, its ticks are stored even when a later step fails, so the
     Level pages card lists the new record's pages as the API has them,
     ready to write, rather than as a tick still waiting for a save. */
  it('lists the new record\'s level pages after a later step fails', async () => {
    mocks.listCourseLevels.mockResolvedValue({ data: [phd], meta: null });
    mocks.createSubSubject.mockResolvedValue({ data: specialization({ id: 'spec-new', updatedAt: 'new-v1', courseLevels: [phdTick] }) });
    mocks.publishSubSubject.mockRejectedValueOnce(refusal('Complete Sub-Subject fields before publishing', 'SUB_SUBJECT_NOT_READY'));
    mocks.getSpecialization.mockResolvedValue({ data: specialization({ id: 'spec-new', updatedAt: 'new-v2', courseLevels: [phdTick] }) });
    mocks.listLevelPages.mockResolvedValue({ data: [phdRow], meta: null });
    const user = userEvent.setup();
    await startNew(user);
    await user.click(screen.getByRole('checkbox', { name: 'PhD' }));

    /* Before the save, the tick alone puts the row there. */
    const ticked = cardRow('PhD')!;
    expect(within(ticked).getByText('Not saved yet')).toBeInTheDocument();
    expect(within(ticked).getByText('/subjects/marine-sciences/marine-biology/phd')).toBeInTheDocument();
    expect(within(ticked).getByRole('button', { name: 'Save and write the PhD page' })).toBeInTheDocument();
    expect(screen.getByText(notSavedHint)).toBeInTheDocument();
    expect(mocks.listLevelPages).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    expect(await screen.findByText('Complete Sub-Subject fields before publishing')).toBeInTheDocument();
    expect(mocks.createSubSubject.mock.calls[0][1]).toMatchObject({ courseLevelIds: ['lvl-phd'] });
    await waitFor(() => expect(mocks.listLevelPages).toHaveBeenCalledWith('specialization', 'spec-new'));
    expect(await screen.findByRole('link', { name: 'Write the PhD page' })).toHaveAttribute('href', '/specializations/spec-new/level-pages/lvl-phd');
    expect(within(cardRow('PhD')!).queryByText('Not saved yet')).toBeNull();
    expect(screen.queryByText(notSavedHint)).toBeNull();
  });

  /* A level offered only because it was ticked goes when it is unticked. The
     row says so before the save, and leaves the list after it. */
  it('marks a level unticked as leaving, until the save takes it off', async () => {
    mocks.listCourseLevels.mockResolvedValue({ data: [phd], meta: null });
    mocks.getSpecialization.mockResolvedValue({ data: specialization({ courseLevels: [phdTick] }) });
    mocks.listLevelPages.mockResolvedValue({ data: [phdRow], meta: null });
    const user = userEvent.setup();
    render(<SpecializationForm id="spec-1" />);
    await screen.findByRole('link', { name: 'Write the PhD page' });
    expect(screen.queryByText(notSavedHint)).toBeNull();

    await user.click(screen.getByRole('checkbox', { name: 'PhD' }));
    const row = cardRow('PhD')!;
    expect(within(row).getByText('Removed when you save')).toBeInTheDocument();
    expect(within(row).getByText('Unticked. It leaves this list when you save.')).toBeInTheDocument();
    expect(within(row).queryByRole('link', { name: 'Write the PhD page' })).toBeNull();
    expect(within(row).queryByRole('button', { name: /^Save and / })).toBeNull();
    /* The row says what the save does itself; the hint is about "Not saved
       yet" rows, and there are none. */
    expect(screen.queryByText(notSavedHint)).toBeNull();

    mocks.listLevelPages.mockResolvedValue({ data: [], meta: null });
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.listLevelPages).toHaveBeenCalledTimes(2));
    expect(mocks.updateSubSubject.mock.calls[0][2]).toMatchObject({ courseLevelIds: [] });
    expect(await screen.findByText(/No study level is offered yet/)).toBeInTheDocument();
    expect(cardRow('PhD')).toBeNull();
    expect(screen.queryByText(notSavedHint)).toBeNull();
  });

  /* /specializations/new and /specializations/[id] are separate routes, so
     its own editor is a fresh one that reads it back. "Edit specialization"
     showed before it arrived, and an untick made in between was undone. */
  it('stays locked from a new specialization\'s save until its own editor takes over', async () => {
    mocks.listCourseLevels.mockResolvedValue({ data: [phd], meta: null });
    mocks.createSubSubject.mockResolvedValue({ data: specialization({ id: 'spec-new', updatedAt: 'new-v1', courseLevels: [phdTick] }) });
    const user = userEvent.setup();
    await startNew(user);
    await user.click(screen.getByRole('checkbox', { name: 'PhD' }));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/specializations/spec-new'));
    expect(screen.getByRole('heading', { name: 'Edit specialization' })).toBeInTheDocument();
    const box = screen.getByRole('checkbox', { name: 'PhD' });
    expect(box).toBeDisabled();
    await user.click(box);
    expect(box).toBeChecked();
    expect(screen.getByRole('textbox', { name: /^Name/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(mocks.updateSubSubject).not.toHaveBeenCalled();
  });

  /* The FAQs are written one by one. When the second is refused, the first
     already exists: the retry updates it instead of adding it twice. */
  it('keeps each FAQ it has written, so a retry after a failed one does not add it twice', async () => {
    mocks.createSubSubject.mockResolvedValue({ data: specialization({ id: 'spec-new', updatedAt: 'new-v1' }) });
    mocks.getSpecialization.mockResolvedValue({ data: specialization({ id: 'spec-new', updatedAt: 'new-v1' }) });
    mocks.updateSubSubject.mockResolvedValue({ data: specialization({ id: 'spec-new', updatedAt: 'new-v2' }) });
    mocks.createSpecializationFaq
      .mockResolvedValueOnce({ data: faqRecord('faq-1', 'Is it taught in English?') })
      .mockRejectedValueOnce(refusal('FAQ changed in another session. Reload before saving', 'SUB_SUBJECT_FAQ_STALE_VERSION', 409))
      .mockResolvedValueOnce({ data: faqRecord('faq-2', 'Is there a placement?') });
    mocks.updateSpecializationFaq.mockResolvedValue({ data: faqRecord('faq-1', 'Is it taught in English?', 'faq-1-v2') });
    const user = userEvent.setup();
    await startNew(user);
    await user.type(screen.getByRole('textbox', { name: /^Question/ }), 'Is it taught in English?');
    await user.type(screen.getByRole('textbox', { name: /^Answer/ }), 'Yes.');
    await user.click(screen.getByRole('button', { name: '+ Add another FAQ' }));
    const second = screen.getByRole('heading', { name: 'FAQ 2' }).closest('div')!.parentElement!;
    await user.type(within(second).getByRole('textbox', { name: /^Question/ }), 'Is there a placement?');
    await user.type(within(second).getByRole('textbox', { name: /^Answer/ }), 'Yes.');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('FAQ changed in another session. Reload before saving')).toBeInTheDocument();
    expect(mocks.createSpecializationFaq).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/specializations/spec-new'));
    expect(mocks.createSubSubject).toHaveBeenCalledTimes(1);
    expect(mocks.updateSpecializationFaq).toHaveBeenCalledTimes(1);
    expect(mocks.updateSpecializationFaq.mock.calls[0].slice(0, 2)).toEqual(['spec-new', 'faq-1']);
    expect(mocks.updateSpecializationFaq.mock.calls[0][2]).toMatchObject({ question: 'Is it taught in English?', expectedUpdatedAt: 'faq-1-v1' });
    expect(mocks.createSpecializationFaq).toHaveBeenCalledTimes(3);
    expect(mocks.createSpecializationFaq.mock.calls[2][1]).toMatchObject({ question: 'Is there a placement?' });
  });

  /* Unticking "Robots index" alone keeps the specialization out of search
     engines; it used to be dropped without a word. */
  it('saves robots alone, and sends the SEO version it read each time', async () => {
    mocks.saveSpecializationSeo
      .mockResolvedValueOnce({ data: seoRow({ robotsIndex: false, updatedAt: '2026-10-17T10:00:00.000Z' }) })
      .mockResolvedValueOnce({ data: seoRow({ robotsIndex: false, updatedAt: '2026-10-17T10:05:00.000Z' }) });
    const user = userEvent.setup();
    render(<SpecializationForm id="spec-1" />);
    await screen.findByRole('button', { name: 'Publish' });

    await user.click(screen.getByRole('checkbox', { name: 'Robots index' }));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.saveSpecializationSeo).toHaveBeenCalledTimes(1));
    expect(mocks.saveSpecializationSeo).toHaveBeenLastCalledWith('spec-1', { robotsIndex: false, robotsFollow: true, expectedUpdatedAt: null });
    expect(screen.queryByRole('alert')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.saveSpecializationSeo).toHaveBeenCalledTimes(2));
    expect(mocks.saveSpecializationSeo.mock.calls[1][1]).toMatchObject({ expectedUpdatedAt: '2026-10-17T10:00:00.000Z' });
  });

  it('sends the version of the SEO row it loaded', async () => {
    mocks.getSpecializationSeo.mockResolvedValue({ data: seoRow({ seoTitle: 'Marine Biology', metaDescription: 'Life in the ocean.', updatedAt: '2026-10-02T00:00:00.000Z' }) });
    mocks.saveSpecializationSeo.mockResolvedValue({ data: seoRow({ seoTitle: 'Marine Biology', metaDescription: 'Life in the ocean.', updatedAt: '2026-10-17T00:00:00.000Z' }) });
    const user = userEvent.setup();
    render(<SpecializationForm id="spec-1" />);
    await screen.findByRole('button', { name: 'Publish' });
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.saveSpecializationSeo).toHaveBeenCalledTimes(1));
    expect(mocks.saveSpecializationSeo.mock.calls[0][1]).toMatchObject({ seoTitle: 'Marine Biology', expectedUpdatedAt: '2026-10-02T00:00:00.000Z' });
  });
});

/**
 * "Save and write" on the Level pages card, as on a subject's: a level just
 * ticked can only be written once its tick is saved, so the button saves the
 * specialization as it stands -- published stays published, a draft stays a
 * draft -- and opens that level's page editor instead of the list.
 */
describe('save and write from the Level pages card', () => {
  beforeEach(() => {
    mocks.listCourseLevels.mockResolvedValue({ data: [phd], meta: null });
  });

  it('saves a published specialization with the new tick, keeps it published, and opens the level\'s page', async () => {
    mocks.getSpecialization.mockResolvedValue({ data: specialization({ status: 'PUBLISHED' }) });
    mocks.updateSubSubject.mockResolvedValue({ data: specialization({ status: 'PUBLISHED', updatedAt: 'spec-v2', courseLevels: [phdTick] }) });
    const user = userEvent.setup();
    render(<SpecializationForm id="spec-1" />);
    await screen.findByRole('button', { name: 'Move to draft' });
    await user.click(screen.getByRole('checkbox', { name: 'PhD' }));
    await user.click(screen.getByRole('button', { name: 'Save and write the PhD page' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/specializations/spec-1/level-pages/lvl-phd'));
    expect(mocks.updateSubSubject).toHaveBeenCalledTimes(1);
    expect(mocks.updateSubSubject.mock.calls[0].slice(0, 2)).toEqual(['subject-1', 'spec-1']);
    expect(mocks.updateSubSubject.mock.calls[0][2]).toMatchObject({ courseLevelIds: ['lvl-phd'], expectedUpdatedAt: 'spec-v1' });
    expect(mocks.publishSubSubject).not.toHaveBeenCalled();
    expect(mocks.unpublishSubSubject).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    expect(peekFlash()).toBeNull();
    /* Leaving, the fields stay locked until the page editor takes over. */
    expect(screen.getByRole('textbox', { name: /^Name/ })).toBeDisabled();
  });

  it('keeps a draft specialization a draft, and opens the level\'s page', async () => {
    mocks.updateSubSubject.mockResolvedValue({ data: specialization({ updatedAt: 'spec-v2', courseLevels: [phdTick] }) });
    const user = userEvent.setup();
    render(<SpecializationForm id="spec-1" />);
    await screen.findByRole('button', { name: 'Publish' });
    await user.click(screen.getByRole('checkbox', { name: 'PhD' }));
    await user.click(screen.getByRole('button', { name: 'Save and write the PhD page' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/specializations/spec-1/level-pages/lvl-phd'));
    expect(mocks.updateSubSubject.mock.calls[0][2]).toMatchObject({ courseLevelIds: ['lvl-phd'] });
    expect(mocks.publishSubSubject).not.toHaveBeenCalled();
    expect(mocks.unpublishSubSubject).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    expect(peekFlash()).toBeNull();
  });

  /* A new specialization lists its ticks at the address its subject and
     slug will give them; the button creates it, and its level's page
     replaces the Create entry. */
  it('creates a new specialization with the tick, and replaces the Create entry with the level\'s page', async () => {
    mocks.createSubSubject.mockResolvedValue({ data: specialization({ id: 'spec-new', updatedAt: 'new-v1', courseLevels: [phdTick] }) });
    const user = userEvent.setup();
    await startNew(user);
    expect(screen.getByText(/No study level is ticked yet/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'PhD' }));

    const row = cardRow('PhD')!;
    expect(within(row).getByText('/subjects/marine-sciences/marine-biology/phd')).toBeInTheDocument();
    expect(within(row).getByText('Not saved yet')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Save and write the PhD page' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/specializations/spec-new/level-pages/lvl-phd'));
    expect(mocks.createSubSubject).toHaveBeenCalledTimes(1);
    expect(mocks.createSubSubject.mock.calls[0][0]).toBe('subject-1');
    expect(mocks.createSubSubject.mock.calls[0][1]).toMatchObject({ courseLevelIds: ['lvl-phd'], slug: 'marine-biology' });
    expect(mocks.updateSubSubject).not.toHaveBeenCalled();
    expect(mocks.publishSubSubject).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(peekFlash()).toBeNull();
  });

  it('saves nothing and goes nowhere when the specialization fails its checks', async () => {
    mocks.getSpecialization.mockResolvedValue({ data: specialization({ status: 'PUBLISHED' }) });
    const user = userEvent.setup();
    render(<SpecializationForm id="spec-1" />);
    await screen.findByRole('button', { name: 'Move to draft' });
    await user.click(screen.getByRole('checkbox', { name: 'PhD' }));
    await user.clear(screen.getByRole('textbox', { name: /^Name/ }));
    await user.click(screen.getByRole('button', { name: 'Save and write the PhD page' }));

    expect(await screen.findByText('Specialization name is required.')).toBeInTheDocument();
    expect(mocks.updateSubSubject).not.toHaveBeenCalled();
    expect(mocks.publishSubSubject).not.toHaveBeenCalled();
    expect(mocks.unpublishSubSubject).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    /* The tick waits, unsaved, with the fields free for the fix. */
    expect(within(cardRow('PhD')!).getByText('Not saved yet')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Name/ })).toBeEnabled();
  });
});
