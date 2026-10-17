import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubjectForm } from './SubjectForm';
import { clearFlash, peekFlash } from '@/features/shared/Flash';

/**
 * A subject's specializations are written in their own editor now; the
 * subject's form lists them and links to each. Each is published from its own
 * editor: publishing the subject publishes the subject alone, and moving it
 * to draft leaves its specializations' own status alone -- they are off the
 * site while it is a draft, and back once it is published again.
 */

const push = vi.fn();
const replace = vi.fn();

const mocks = vi.hoisted(() => ({
  getSubject: vi.fn(),
  getSubjectSeo: vi.fn(),
  listAllSubSubjects: vi.fn(),
  createSubject: vi.fn(),
  updateSubject: vi.fn(),
  publishSubject: vi.fn(),
  unpublishSubject: vi.fn(),
  publishSubSubject: vi.fn(),
  unpublishSubSubject: vi.fn(),
  saveSubjectSeo: vi.fn(),
  deleteSubjectSeo: vi.fn(),
  listEditorialMedia: vi.fn(),
  listCourseLevels: vi.fn(),
  listCountries: vi.fn(),
  listEvery: vi.fn(),
  getSubjectCountries: vi.fn(),
  saveSubjectCountries: vi.fn(),
  listLevelPages: vi.fn(),
  deleteLevelPage: vi.fn(),
}));
vi.mock('./catalog-client', () => mocks);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/', }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const subject = {
  id: 'subject-1',
  name: 'Marine Sciences',
  slug: 'marine-sciences',
  shortDescription: 'Oceans.',
  overview: null,
  iconMedia: null,
  listingMedia: null,
  heroMedia: null,
  featured: false,
  displayOrder: 0,
  status: 'DRAFT',
  updatedAt: 'subject-v1',
};

const child = (updatedAt: string, status: string, shortDescription: string | null = 'Life in the ocean.') => ({
  id: 'spec-1',
  subject: { id: 'subject-1', name: 'Marine Sciences', slug: 'marine-sciences' },
  name: 'Marine Biology',
  slug: 'marine-biology',
  shortDescription,
  overview: null,
  iconMedia: null,
  listingMedia: null,
  featured: false,
  displayOrder: 0,
  status,
  updatedAt,
});

beforeEach(() => {
  vi.clearAllMocks();
  clearFlash();
  mocks.getSubject.mockResolvedValue({ data: subject });
  mocks.getSubjectSeo.mockResolvedValue({ data: null });
  mocks.listAllSubSubjects.mockResolvedValue([child('spec-v1', 'DRAFT')]);
  mocks.listEditorialMedia.mockResolvedValue({ data: [], meta: null });
  mocks.listCourseLevels.mockResolvedValue({ data: [], meta: null });
  mocks.listEvery.mockResolvedValue([]);
  mocks.getSubjectCountries.mockResolvedValue({ data: [] });
  mocks.saveSubjectCountries.mockResolvedValue({ data: [] });
  mocks.updateSubject.mockResolvedValue({ data: { ...subject, updatedAt: 'subject-v2' } });
  mocks.publishSubject.mockResolvedValue({
    data: { ...subject, status: 'PUBLISHED', updatedAt: 'subject-v3' },
  });
  mocks.unpublishSubject.mockResolvedValue({
    data: { ...subject, status: 'DRAFT', updatedAt: 'subject-v4' },
  });
  mocks.publishSubSubject.mockResolvedValue({ data: child('spec-v2', 'PUBLISHED') });
  mocks.unpublishSubSubject.mockResolvedValue({ data: child('spec-v3', 'DRAFT') });
  mocks.listLevelPages.mockResolvedValue({ data: [], meta: null });
});

const seoRow = (patch: Record<string, unknown> = {}) => ({
  id: 'seo-1', ownerType: 'SUBJECT', ownerId: 'subject-1', seoTitle: null, metaDescription: null, canonicalUrl: null, focusKeyword: null, ogTitle: null, ogDescription: null, ogMediaId: null, twitterTitle: null, twitterDescription: null, twitterMediaId: null, robotsIndex: true, robotsFollow: true, schemaJson: null, hreflangJson: null, ogMedia: null, twitterMedia: null, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  ...patch,
});

describe('subject form and its specializations', () => {
  it('lists each specialization with a link to its own editor', async () => {
    render(<SubjectForm id="subject-1" />);
    await screen.findByRole('button', { name: 'Publish' });

    expect(screen.getByText('Marine Biology')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/specializations/spec-1');
    expect(screen.getByRole('link', { name: '+ Add specialization' })).toHaveAttribute(
      'href',
      '/specializations/new?subject=subject-1',
    );
  });

  it('flags a specialization that has no short description, without blocking publish', async () => {
    mocks.listAllSubSubjects.mockResolvedValue([child('spec-v1', 'DRAFT', null)]);
    const user = userEvent.setup();
    render(<SubjectForm id="subject-1" />);
    await screen.findByRole('button', { name: 'Publish' });

    expect(screen.getByText('No short description')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(mocks.publishSubject).toHaveBeenCalledTimes(1));
    expect(mocks.publishSubSubject).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  /* Publishing a subject used to publish every draft specialization under
     it too, half-written ones included. */
  it('publishes the subject alone: its draft specializations stay drafts', async () => {
    mocks.listAllSubSubjects.mockResolvedValue([child('spec-v1', 'DRAFT'), { ...child('spec-v1', 'PUBLISHED'), id: 'spec-2', name: 'Oceanography' }]);
    const user = userEvent.setup();
    render(<SubjectForm id="subject-1" />);
    await screen.findByRole('button', { name: 'Publish' });

    expect(screen.getByText(/is published from there: publishing this subject leaves its drafts as drafts/)).toBeInTheDocument();
    expect(screen.getByText(/Its specializations are published on their own, each from its own editor\./)).toBeInTheDocument();
    expect(screen.getByText('DRAFT', { selector: '.p-badge' })).toHaveAttribute('title', 'Not on the site until it is published from its own editor.');
    expect(screen.getByText('PUBLISHED', { selector: '.p-badge' })).not.toHaveAttribute('title');

    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/subjects'));
    expect(mocks.publishSubject).toHaveBeenCalledWith('subject-1', 'subject-v2');
    expect(mocks.publishSubSubject).not.toHaveBeenCalled();
    expect(mocks.unpublishSubSubject).not.toHaveBeenCalled();
  });

  /* Moving the subject to draft used to move every specialization with it,
     so publishing it again left them all drafts. They are off the site
     while the subject is a draft whatever their own status. */
  it('moves the subject alone to draft, leaving its published specializations as they are', async () => {
    mocks.getSubject.mockResolvedValue({ data: { ...subject, status: 'PUBLISHED' } });
    mocks.updateSubject.mockResolvedValue({ data: { ...subject, status: 'PUBLISHED', updatedAt: 'subject-v2' } });
    mocks.listAllSubSubjects.mockResolvedValue([child('spec-v1', 'PUBLISHED')]);
    const user = userEvent.setup();
    render(<SubjectForm id="subject-1" />);
    await user.click(await screen.findByRole('button', { name: 'Move to draft' }));

    await waitFor(() => expect(mocks.unpublishSubject).toHaveBeenCalledWith('subject-1', 'subject-v2'));
    expect(mocks.unpublishSubSubject).not.toHaveBeenCalled();
    expect(mocks.publishSubSubject).not.toHaveBeenCalled();
    expect(screen.getByText('PUBLISHED', { selector: '.p-badge' })).toBeInTheDocument();
  });

  it('goes back to the list with a green confirmation once published, naming the drafts it left', async () => {
    const user = userEvent.setup();
    render(<SubjectForm id="subject-1" />);
    await user.click(await screen.findByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/subjects'));
    expect(peekFlash()).toMatchObject({
      tone: 'success',
      message: 'Marine Sciences published successfully. Its draft specialization stays off the site until it is published on its own.',
    });
  });

  it('says only that it was published when no specialization is left in draft', async () => {
    mocks.listAllSubSubjects.mockResolvedValue([child('spec-v1', 'PUBLISHED')]);
    const user = userEvent.setup();
    render(<SubjectForm id="subject-1" />);
    await user.click(await screen.findByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/subjects'));
    expect(peekFlash()).toMatchObject({ tone: 'success', message: 'Marine Sciences published successfully.' });
  });

  it('stays in the editor when a draft is saved', async () => {
    const user = userEvent.setup();
    render(<SubjectForm id="subject-1" />);
    await user.click(await screen.findByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(mocks.updateSubject).toHaveBeenCalledTimes(1));
    expect(push).not.toHaveBeenCalled();
    expect(peekFlash()).toBeNull();
  });

  /* The Level pages card sits under the study-level ticks and lists what the
     API says is offered, so it follows the ticks once they are saved and
     says so until then. */
  it('shows the Level pages card, and reads its rows again after a save', async () => {
    mocks.listCourseLevels.mockResolvedValue({
      data: [{ id: 'lvl-ug', code: 'UG', name: "Bachelor's", description: null, educationOrder: 3, displayOrder: 0, status: 'ACTIVE', createdAt: 'c', updatedAt: 'u' }],
      meta: null,
    });
    const user = userEvent.setup();
    render(<SubjectForm id="subject-1" />);
    await screen.findByRole('button', { name: 'Publish' });

    expect(screen.getByRole('heading', { name: 'Level pages' })).toBeInTheDocument();
    await waitFor(() => expect(mocks.listLevelPages).toHaveBeenCalledWith('subject', 'subject-1'));
    expect(await screen.findByText(/No study level is offered yet/)).toBeInTheDocument();
    expect(screen.queryByText('Study level changes show here after you save.')).toBeNull();

    await user.click(await screen.findByRole('checkbox', { name: "Bachelor's" }));
    expect(screen.getByText('Study level changes show here after you save.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.listLevelPages).toHaveBeenCalledTimes(2));
    expect(mocks.updateSubject.mock.calls[0][1]).toMatchObject({ courseLevelIds: ['lvl-ug'] });
    expect(screen.queryByText('Study level changes show here after you save.')).toBeNull();
  });

  it('names the subject in the SEO alert, not a country', async () => {
    const user = userEvent.setup();
    render(<SubjectForm id="subject-1" />);
    await screen.findByRole('button', { name: 'Publish' });
    await user.type(screen.getByRole('textbox', { name: 'Focus keyword' }), 'oceans');
    expect(screen.getByText('SEO title and Meta description are required before this subject can be saved.')).toBeInTheDocument();
  });

  /* Enter in a text field clicked the form's first submit button -- Move to
     draft, on a live subject -- and took it and its specializations off the
     site. */
  it('saves nothing when Enter is pressed in a text field of a published subject', async () => {
    mocks.getSubject.mockResolvedValue({ data: { ...subject, status: 'PUBLISHED' } });
    const user = userEvent.setup();
    const { container } = render(<SubjectForm id="subject-1" />);
    await screen.findByRole('button', { name: 'Move to draft' });

    await user.type(container.querySelector<HTMLInputElement>('#subject-name')!, ' II{Enter}');
    await user.type(container.querySelector<HTMLInputElement>('#subject-slug')!, '{Enter}');
    await user.type(container.querySelector<HTMLInputElement>('#subject-order')!, '{Enter}');
    expect(mocks.updateSubject).not.toHaveBeenCalled();
    expect(mocks.unpublishSubject).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(mocks.updateSubject).toHaveBeenCalledTimes(1));
    expect(mocks.updateSubject.mock.calls[0][1]).toMatchObject({ name: 'Marine Sciences II' });
    expect(mocks.unpublishSubject).not.toHaveBeenCalled();
  });

  /* A step after "create" can fail -- publishing, the SEO -- and the form
     used to stay a create: the retry was refused on the subject's own slug,
     and a half-saved draft sat in the list. */
  it('adopts a new subject the moment it is created, so the retry updates it', async () => {
    const addressBar = vi.spyOn(window.history, 'replaceState');
    const created = { ...subject, id: 'subject-new', updatedAt: 'new-v1' };
    mocks.createSubject.mockResolvedValue({ data: created });
    mocks.publishSubject.mockRejectedValueOnce(Object.assign(new Error('Complete subject fields before publishing'), { code: 'SUBJECT_NOT_READY', status: 422, details: null }));
    /* Re-read after the failure: the version the retry must send. */
    mocks.getSubject.mockResolvedValue({ data: { ...created, updatedAt: 'new-v2' } });
    mocks.listAllSubSubjects.mockResolvedValue([]);
    mocks.updateSubject.mockResolvedValue({ data: { ...created, updatedAt: 'new-v3' } });
    const user = userEvent.setup();
    const { container } = render(<SubjectForm />);
    await screen.findByRole('button', { name: 'Publish' });
    await user.type(container.querySelector<HTMLInputElement>('#subject-name')!, 'Marine Sciences');
    await user.type(container.querySelector<HTMLTextAreaElement>('#subject-short')!, 'Oceans.');
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    expect(await screen.findByText('Complete subject fields before publishing')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edit subject' })).toBeInTheDocument();
    /* The address follows at once, without swapping the route under the save. */
    expect(addressBar).toHaveBeenCalledWith(null, '', '/subjects/subject-new');
    expect(replace).not.toHaveBeenCalled();
    expect(mocks.getSubject).toHaveBeenCalledWith('subject-new');

    await user.click(screen.getByRole('button', { name: 'Publish' }));
    /* Still made in this session: the list replaces the adopted entry. */
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/subjects'));
    expect(push).not.toHaveBeenCalled();
    expect(mocks.createSubject).toHaveBeenCalledTimes(1);
    expect(mocks.updateSubject).toHaveBeenCalledTimes(1);
    expect(mocks.updateSubject.mock.calls[0][0]).toBe('subject-new');
    expect(mocks.updateSubject.mock.calls[0][1]).toMatchObject({ expectedUpdatedAt: 'new-v2', slug: 'marine-sciences' });
  });

  /* The adopted entry holds the Create route under the subject's address.
     Pushing the list past it left Back on a blank Create form there. */
  it('replaces the adopted history entry when a new subject is published', async () => {
    mocks.createSubject.mockResolvedValue({ data: { ...subject, id: 'subject-new', updatedAt: 'new-v1' } });
    const user = userEvent.setup();
    const { container } = render(<SubjectForm />);
    await screen.findByRole('button', { name: 'Publish' });
    await user.type(container.querySelector<HTMLInputElement>('#subject-name')!, 'Marine Sciences');
    await user.type(container.querySelector<HTMLTextAreaElement>('#subject-short')!, 'Oceans.');
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/subjects'));
    expect(push).not.toHaveBeenCalled();
    expect(peekFlash()).toMatchObject({ tone: 'success' });
  });

  it('swaps to the subject\'s own route once a new draft is fully saved', async () => {
    mocks.createSubject.mockResolvedValue({ data: { ...subject, id: 'subject-new', updatedAt: 'new-v1' } });
    const user = userEvent.setup();
    const { container } = render(<SubjectForm />);
    await screen.findByRole('button', { name: 'Save draft' });
    await user.type(container.querySelector<HTMLInputElement>('#subject-name')!, 'Marine Sciences');
    await user.type(container.querySelector<HTMLTextAreaElement>('#subject-short')!, 'Oceans.');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/subjects/subject-new'));
    expect(mocks.getSubject).not.toHaveBeenCalled();
  });

  /* Unticking "Robots index" on its own keeps the subject out of search
     engines. It used to be dropped: no row was sent, and the tick came back
     on reload. */
  it('saves robots alone, and sends the SEO version it read each time', async () => {
    mocks.saveSubjectSeo
      .mockResolvedValueOnce({ data: seoRow({ robotsIndex: false, updatedAt: '2026-10-17T10:00:00.000Z' }) })
      .mockResolvedValueOnce({ data: seoRow({ robotsIndex: false, updatedAt: '2026-10-17T10:05:00.000Z' }) });
    const user = userEvent.setup();
    render(<SubjectForm id="subject-1" />);
    await screen.findByRole('button', { name: 'Publish' });

    await user.click(screen.getByRole('checkbox', { name: 'Robots index' }));
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.saveSubjectSeo).toHaveBeenCalledTimes(1));
    /* No row was read, so the version says so. */
    expect(mocks.saveSubjectSeo).toHaveBeenLastCalledWith('subject-1', { robotsIndex: false, robotsFollow: true, expectedUpdatedAt: null });
    expect(screen.queryByRole('alert')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.saveSubjectSeo).toHaveBeenCalledTimes(2));
    expect(mocks.saveSubjectSeo.mock.calls[1][1]).toMatchObject({ expectedUpdatedAt: '2026-10-17T10:00:00.000Z' });
    expect(mocks.deleteSubjectSeo).not.toHaveBeenCalled();
  });

  it('sends the version of the SEO row it loaded, and says when another session changed it', async () => {
    mocks.getSubjectSeo.mockResolvedValue({ data: seoRow({ seoTitle: 'Oceans', metaDescription: 'Study the sea.', updatedAt: '2026-10-02T00:00:00.000Z' }) });
    mocks.saveSubjectSeo.mockRejectedValue(Object.assign(new Error('The SEO changed in another session. Reload before saving'), { code: 'SEO_STALE_VERSION', status: 409, details: null }));
    const user = userEvent.setup();
    render(<SubjectForm id="subject-1" />);
    await screen.findByRole('button', { name: 'Publish' });
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('The SEO changed in another session. Reload before saving')).toBeInTheDocument();
    expect(mocks.saveSubjectSeo.mock.calls[0][1]).toMatchObject({ seoTitle: 'Oceans', metaDescription: 'Study the sea.', expectedUpdatedAt: '2026-10-02T00:00:00.000Z' });
  });

  it('still removes a stored row once nothing is written and both robots ticks are on', async () => {
    mocks.getSubjectSeo.mockResolvedValue({ data: seoRow({ robotsIndex: false, updatedAt: '2026-10-02T00:00:00.000Z' }) });
    mocks.deleteSubjectSeo.mockResolvedValue({ data: { deleted: true } });
    const user = userEvent.setup();
    render(<SubjectForm id="subject-1" />);
    await screen.findByRole('button', { name: 'Publish' });
    expect(screen.getByRole('checkbox', { name: 'Robots index' })).not.toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Robots index' }));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.deleteSubjectSeo).toHaveBeenCalledWith('subject-1', '2026-10-02T00:00:00.000Z'));
    expect(mocks.saveSubjectSeo).not.toHaveBeenCalled();
  });
});
