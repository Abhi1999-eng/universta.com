import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubjectsPage } from './SubjectsPage';

/**
 * The subjects list: its Levels column shows what the site offers each
 * subject at, a delete refused for its courses says, inside its dialog,
 * which courses are in the way, and publishing a subject says which of its
 * specializations it left in draft.
 */

const mocks = vi.hoisted(() => ({
  deleteSubject: vi.fn(),
  listSubjects: vi.fn(),
  publishSubject: vi.fn(),
  unpublishSubject: vi.fn(),
}));
vi.mock('./catalog-client', () => mocks);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/subjects' }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const meta = { page: 1, limit: 12, total: 1, totalPages: 1 };
const ug = { id: 'lvl-ug', code: 'UG', name: "Bachelor's" };
const pg = { id: 'lvl-pg', code: 'PG', name: "Master's" };
const row = (name: string, slug: string, patch: Record<string, unknown> = {}) => ({
  id: `subject-${slug}`,
  name,
  slug,
  shortDescription: 'Oceans.',
  overview: null,
  iconMedia: null,
  listingMedia: null,
  heroMedia: null,
  isFeatured: false,
  displayOrder: 0,
  courseLevels: [],
  status: 'DRAFT',
  publishedAt: null,
  createdAt: 'c',
  updatedAt: new Date().toISOString(),
  ...patch,
});
const refusal = (details: unknown) => Object.assign(new Error('A subject referenced by courses cannot be deleted'), { code: 'SUBJECT_IN_USE', status: 409, details });

beforeEach(() => {
  mocks.listSubjects.mockImplementation((params: { limit?: number }) =>
    Promise.resolve(params.limit === 1 ? { data: [], meta: { ...meta, total: 0 } } : { data: [row('Marine Sciences', 'marine-sciences')], meta }),
  );
});

async function askToDelete(user: ReturnType<typeof userEvent.setup>) {
  const tr = (await screen.findByRole('link', { name: 'Marine Sciences' })).closest('tr') as HTMLElement;
  await user.click(within(tr).getByRole('button', { name: 'More actions' }));
  await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
  await user.type(screen.getByRole('textbox', { name: 'Confirm subject name' }), 'Marine Sciences');
  await user.click(screen.getByRole('button', { name: 'Confirm' }));
}

describe('subjects list', () => {
  /* A subject with no ticks of its own whose specializations tick Bachelor's
     read "—" here and "Bachelor's" on the site. */
  it('shows the levels the site offers each subject at, and says where they come from', async () => {
    mocks.listSubjects.mockImplementation((params: { limit?: number }) =>
      Promise.resolve(params.limit === 1 ? { data: [], meta: { ...meta, total: 0 } } : {
        data: [
          row('Marine Sciences', 'marine-sciences', { courseLevels: [], offeredLevels: [ug, pg] }),
          row('Law', 'law', { courseLevels: [pg], offeredLevels: [] }),
          row('Physics', 'physics', { courseLevels: [pg] }),
        ],
        meta: { ...meta, total: 3 },
      }),
    );
    render(<SubjectsPage />);
    const offered = (await screen.findByRole('link', { name: 'Marine Sciences' })).closest('tr') as HTMLElement;
    expect(within(offered).getByText("Bachelor's, Master's")).toBeInTheDocument();
    const none = screen.getByRole('link', { name: 'Law' }).closest('tr') as HTMLElement;
    expect(within(none).getByText('—')).toBeInTheDocument();
    /* A row without the offered set still shows its ticks. */
    const ticked = screen.getByRole('link', { name: 'Physics' }).closest('tr') as HTMLElement;
    expect(within(ticked).getByText("Master's")).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Levels' }).querySelector('[title]')).toHaveAttribute(
      'title',
      expect.stringMatching(/ticked on it, the levels ticked on its published specializations, and the levels of its published courses/),
    );
  });

  /* A deleted course is kept in the database and listed nowhere, so "a
     subject referenced by courses" sent editors looking for courses they
     could not find. The dialog now says which kind is in the way. */
  it('says inside the dialog that deleted courses still point at the subject', async () => {
    mocks.deleteSubject.mockRejectedValue(refusal({ liveCourses: 0, deletedCourses: 2 }));
    const user = userEvent.setup();
    render(<SubjectsPage />);
    await askToDelete(user);

    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('2 deleted courses still point at this subject; they must be removed from the database first.');
    expect(mocks.deleteSubject).toHaveBeenCalledTimes(1);
  });

  it('counts the courses that still use it, and clears the message when the dialog closes', async () => {
    mocks.deleteSubject.mockRejectedValue(refusal({ liveCourses: 3, deletedCourses: 0 }));
    const user = userEvent.setup();
    render(<SubjectsPage />);
    await askToDelete(user);
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('3 courses still use this subject. Move them to another subject first.');

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const tr = screen.getByRole('link', { name: 'Marine Sciences' }).closest('tr') as HTMLElement;
    await user.click(within(tr).getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(within(screen.getByRole('dialog')).queryByRole('alert')).toBeNull();
  });

  /* A subject publishes alone; its specializations are published one by
     one. The toast names the drafts left behind so nobody takes them for
     live. */
  it('publishes a subject from its row and names the specializations it left in draft', async () => {
    const children = [
      { id: 'spec-1', name: 'Marine Biology', slug: 'marine-biology', status: 'DRAFT' },
      { id: 'spec-2', name: 'Oceanography', slug: 'oceanography', status: 'DRAFT' },
      { id: 'spec-3', name: 'Hydrography', slug: 'hydrography', status: 'PUBLISHED' },
    ];
    mocks.listSubjects.mockImplementation((params: { limit?: number }) =>
      Promise.resolve(params.limit === 1 ? { data: [], meta: { ...meta, total: 0 } } : { data: [row('Marine Sciences', 'marine-sciences', { subSubjects: children })], meta }),
    );
    mocks.publishSubject.mockResolvedValue({ data: row('Marine Sciences', 'marine-sciences', { status: 'PUBLISHED', subSubjects: children }) });
    const user = userEvent.setup();
    render(<SubjectsPage />);
    const tr = (await screen.findByRole('link', { name: 'Marine Sciences' })).closest('tr') as HTMLElement;
    await user.click(within(tr).getByRole('button', { name: 'Publish' }));

    expect(await screen.findByText('Marine Sciences published. Its 2 draft specializations stay off the site until each is published on its own.')).toBeInTheDocument();
    expect(mocks.publishSubject).toHaveBeenCalledTimes(1);
  });

  it('says only that it was published when none of its specializations is a draft', async () => {
    mocks.listSubjects.mockImplementation((params: { limit?: number }) =>
      Promise.resolve(params.limit === 1 ? { data: [], meta: { ...meta, total: 0 } } : { data: [row('Marine Sciences', 'marine-sciences', { subSubjects: [{ id: 'spec-3', name: 'Hydrography', slug: 'hydrography', status: 'PUBLISHED' }] })], meta }),
    );
    mocks.publishSubject.mockResolvedValue({ data: row('Marine Sciences', 'marine-sciences', { status: 'PUBLISHED' }) });
    const user = userEvent.setup();
    render(<SubjectsPage />);
    const tr = (await screen.findByRole('link', { name: 'Marine Sciences' })).closest('tr') as HTMLElement;
    await user.click(within(tr).getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Marine Sciences published.')).toBeInTheDocument();
  });

  it('names the draft specializations a bulk publish left behind', async () => {
    mocks.listSubjects.mockImplementation((params: { limit?: number }) =>
      Promise.resolve(params.limit === 1 ? { data: [], meta: { ...meta, total: 0 } } : {
        data: [
          row('Marine Sciences', 'marine-sciences', { subSubjects: [{ id: 'spec-1', name: 'Marine Biology', slug: 'marine-biology', status: 'DRAFT' }] }),
          row('Law', 'law', { subSubjects: [{ id: 'spec-2', name: 'Tax Law', slug: 'tax-law', status: 'DRAFT' }] }),
        ],
        meta: { ...meta, total: 2 },
      }),
    );
    mocks.publishSubject.mockResolvedValue({ data: row('Marine Sciences', 'marine-sciences', { status: 'PUBLISHED' }) });
    const user = userEvent.setup();
    render(<SubjectsPage />);
    await screen.findByRole('link', { name: 'Marine Sciences' });
    await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    await user.click(screen.getByRole('button', { name: 'Publish 2' }));
    expect(await screen.findByText('2 published. Their 2 draft specializations stay off the site until each is published on its own.')).toBeInTheDocument();
  });

  it('falls back to the headline when the counts are missing, and still deletes when nothing is in the way', async () => {
    mocks.deleteSubject.mockRejectedValueOnce(refusal(null)).mockResolvedValueOnce({ data: { deleted: true } });
    const user = userEvent.setup();
    render(<SubjectsPage />);
    await askToDelete(user);
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('A subject referenced by courses cannot be deleted');

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Marine Sciences deleted.')).toBeInTheDocument();
  });
});
