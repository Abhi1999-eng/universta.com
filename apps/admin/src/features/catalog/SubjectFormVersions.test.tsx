import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubjectForm } from './SubjectForm';
import { clearFlash, peekFlash } from '@/features/shared/Flash';

/**
 * A subject's specializations are written in their own editor now; the
 * subject's form lists them, links to each, and publishing the subject still
 * publishes the drafts among them. Publishing bumps a record's version, so
 * the rows the form keeps must be the ones publishing returned: writing back
 * the pre-publish rows left every specialization a version behind, and the
 * next save was refused with "changed in another session".
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
    await waitFor(() => expect(mocks.publishSubSubject).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('publishes the draft specializations with the subject and keeps the versions publishing returned', async () => {
    const user = userEvent.setup();
    const { container } = render(<SubjectForm id="subject-1" />);

    await screen.findByRole('button', { name: 'Publish' });
    const short = container.querySelector<HTMLTextAreaElement>('#subject-short')!;
    await user.clear(short);
    await user.type(short, 'First edit.');
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(mocks.publishSubSubject).toHaveBeenCalledTimes(1));
    expect(mocks.publishSubSubject).toHaveBeenCalledWith('subject-1', 'spec-1', 'spec-v1');

    // Moving the subject back to draft unpublishes the child with the version
    // publishing handed back, not the one from before it.
    await user.click(screen.getByRole('button', { name: 'Move to draft' }));
    await waitFor(() => expect(mocks.unpublishSubSubject).toHaveBeenCalledTimes(1));
    expect(mocks.unpublishSubSubject).toHaveBeenCalledWith('subject-1', 'spec-1', 'spec-v2');
  });

  it('goes back to the list with a green confirmation once published', async () => {
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
});
