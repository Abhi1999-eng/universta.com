import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LevelPagesCard } from './LevelPagesCard';
import type { LevelPageRow } from './catalog.types';
import { clearFlash, queueFlash } from '@/features/shared/Flash';

/**
 * The Level pages card on a subject's or a specialization's editor: one row
 * per level the API says is offered, what each page has, a link to write it,
 * and a way to delete what was written. It sits inside the owner's <form>,
 * so nothing in it may submit that form.
 */

const mocks = vi.hoisted(() => ({
  listLevelPages: vi.fn(),
  deleteLevelPage: vi.fn(),
  navigated: vi.fn(),
}));
vi.mock('./catalog-client', () => ({ listLevelPages: mocks.listLevelPages, deleteLevelPage: mocks.deleteLevelPage }));
/* Behaves as Next's link does: the click handler runs first, and a handler
   that prevents the default stops the navigation. */
vi.mock('next/link', () => ({
  default: ({ children, href, onClick, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a
      {...rest}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) mocks.navigated(href);
        event.preventDefault();
      }}
    >
      {children}
    </a>
  ),
}));

const ug = { id: 'lvl-ug', code: 'UG', name: "Bachelor's", slug: 'bachelors', description: null, status: 'ACTIVE' };
const phd = { id: 'lvl-phd', code: 'PHD', name: 'PhD', slug: 'phd', description: null, status: 'ACTIVE' };
type Page = NonNullable<LevelPageRow['page']>;
const page = (overrides: Partial<Page> = {}): Page => ({
  id: 'page-1', status: 'DRAFT', hasIntro: true, hasAdmissionNote: false, hasCareersNote: false,
  faqCount: 1, hasSeo: false, searchReady: false, updatedAt: 'v1', ...overrides,
});
const row = (overrides: Partial<LevelPageRow> = {}): LevelPageRow => ({
  level: ug, offered: true, sources: ['TICKED'], path: '/subjects/marine-sciences/bachelors', page: null, ...overrides,
});

const props = {
  owner: 'subject' as const,
  ownerId: 'subject-1',
  ownerName: 'Marine Sciences',
  ownerPublished: false,
  refreshKey: 0,
  ticksChanged: false,
  parentDirty: false,
};

beforeEach(() => {
  clearFlash();
  mocks.listLevelPages.mockResolvedValue({ data: [row()], meta: null });
  mocks.deleteLevelPage.mockResolvedValue({ data: { deleted: true }, meta: null });
});

describe('before the owner is saved', () => {
  it('asks for a save first and reads nothing', () => {
    render(<LevelPagesCard {...props} ownerId={undefined} />);
    expect(screen.getByRole('heading', { name: 'Level pages' })).toBeInTheDocument();
    expect(screen.getByText(/Save the subject first/)).toBeInTheDocument();
    expect(mocks.listLevelPages).not.toHaveBeenCalled();
  });

  it('names a specialization in the same place', () => {
    render(<LevelPagesCard {...props} owner="specialization" ownerId={undefined} />);
    expect(screen.getByText(/Save the specialization first/)).toBeInTheDocument();
  });
});

describe('the rows', () => {
  it('says in two sentences what the pages are', async () => {
    const { unmount } = render(<LevelPagesCard {...props} />);
    expect(
      screen.getByText('One page for each study level this subject is offered at. Each page already lists its programmes; write an intro, notes and FAQs to give it words of its own.'),
    ).toBeInTheDocument();
    await screen.findByRole('link', { name: "Write the Bachelor's page" });
    unmount();

    render(<LevelPagesCard {...props} owner="specialization" ownerId="spec-1" />);
    expect(
      screen.getByText('One page for each study level this specialization is offered at. Each page already lists its programmes; write an intro, notes and FAQs to give it words of its own.'),
    ).toBeInTheDocument();
    await screen.findByRole('link', { name: "Write the Bachelor's page" });
  });

  it('offers to write a page that is not written yet, and says why the level is here', async () => {
    mocks.listLevelPages.mockResolvedValue({ data: [row({ sources: ['TICKED', 'COURSES'] })], meta: null });
    render(<LevelPagesCard {...props} />);
    const link = await screen.findByRole('link', { name: "Write the Bachelor's page" });
    expect(link).toHaveAttribute('href', '/subjects/subject-1/level-pages/lvl-ug');
    /* The full name is the link's label, so every reader gets it whole; the
       button itself shows only the verb. */
    expect(link).toHaveAttribute('aria-label', "Write the Bachelor's page");
    expect(link).toHaveTextContent(/^Write$/);
    expect(mocks.listLevelPages).toHaveBeenCalledWith('subject', 'subject-1');
    expect(screen.getByText('Not written')).toBeInTheDocument();
    expect(screen.getByText('Ticked here · Has published courses')).toBeInTheDocument();
    expect(screen.getByText('/subjects/marine-sciences/bachelors')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /More actions/ })).toBeNull();
  });

  it('shows a draft page with what it has', async () => {
    mocks.listLevelPages.mockResolvedValue({ data: [row({ page: page() })], meta: null });
    render(<LevelPagesCard {...props} />);
    const link = await screen.findByRole('link', { name: "Edit the Bachelor's page" });
    expect(link).toHaveAttribute('aria-label', "Edit the Bachelor's page");
    expect(link).toHaveTextContent(/^Edit$/);
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Intro · 1 FAQ')).toBeInTheDocument();
    expect(screen.queryByText('Search-ready')).toBeNull();
  });

  it('marks a published page search-ready only when the API says so', async () => {
    mocks.listLevelPages.mockResolvedValue({
      data: [
        row({ page: page({ status: 'PUBLISHED', faqCount: 3, searchReady: true }) }),
        row({ level: phd, path: '/subjects/marine-sciences/phd', page: page({ id: 'page-2', status: 'PUBLISHED', faqCount: 2, searchReady: false }) }),
      ],
      meta: null,
    });
    render(<LevelPagesCard {...props} />);
    await screen.findByText('Intro · 3 FAQs');
    expect(screen.getAllByText('Published')).toHaveLength(2);
    expect(screen.getAllByText('Search-ready')).toHaveLength(1);
    expect(screen.getByText('Intro · 2 FAQs')).toBeInTheDocument();
  });

  it('links to the live page only while the owner is published and the level offered', async () => {
    mocks.listLevelPages.mockResolvedValue({
      data: [row(), row({ level: phd, offered: false, sources: [], path: '/subjects/marine-sciences/phd', page: page({ id: 'page-2' }) })],
      meta: null,
    });
    const { unmount } = render(<LevelPagesCard {...props} ownerPublished />);
    await screen.findByText('Not offered now');
    const views = screen.getAllByRole('link', { name: /View on site/ });
    expect(views).toHaveLength(1);
    expect(views[0].getAttribute('href')).toMatch(/\/subjects\/marine-sciences\/bachelors$/);
    unmount();

    render(<LevelPagesCard {...props} ownerPublished={false} />);
    await screen.findByText('Not offered now');
    expect(screen.queryByRole('link', { name: /View on site/ })).toBeNull();
  });

  it('keeps a page whose level is no longer offered, so it can still be deleted', async () => {
    mocks.listLevelPages.mockResolvedValue({
      data: [row({ level: phd, offered: false, sources: [], path: '/subjects/marine-sciences/phd', page: page() })],
      meta: null,
    });
    const user = userEvent.setup();
    render(<LevelPagesCard {...props} />);
    expect(await screen.findByText('Not offered now')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit the PhD page' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More actions for the PhD page' }));
    expect(screen.getByRole('menuitem', { name: 'Delete content' })).toBeInTheDocument();
  });

  it('says when nothing is offered yet', async () => {
    mocks.listLevelPages.mockResolvedValue({ data: [], meta: null });
    render(<LevelPagesCard {...props} />);
    expect(await screen.findByText(/No study level is offered yet/)).toBeInTheDocument();
  });

  it('shows a failure inside the card, with a retry', async () => {
    mocks.listLevelPages.mockRejectedValueOnce(Object.assign(new Error('The catalogue service is unavailable. Wait a moment and try again'), { code: 'SERVICE_UNAVAILABLE' }));
    const user = userEvent.setup();
    render(<LevelPagesCard {...props} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The catalogue service is unavailable');
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('link', { name: "Write the Bachelor's page" })).toBeInTheDocument();
    expect(mocks.listLevelPages).toHaveBeenCalledTimes(2);
  });

  it('reads the rows again when the owner saves', async () => {
    const { rerender } = render(<LevelPagesCard {...props} />);
    await screen.findByRole('link', { name: "Write the Bachelor's page" });
    expect(mocks.listLevelPages).toHaveBeenCalledTimes(1);
    rerender(<LevelPagesCard {...props} refreshKey={1} />);
    await waitFor(() => expect(mocks.listLevelPages).toHaveBeenCalledTimes(2));
  });

  it('says tick changes show after a save', async () => {
    render(<LevelPagesCard {...props} ticksChanged />);
    expect(screen.getByText('Study level changes show here after you save.')).toBeInTheDocument();
    await screen.findByRole('link', { name: "Write the Bachelor's page" });
  });
});

describe('deleting what was written', () => {
  beforeEach(() => {
    mocks.listLevelPages.mockResolvedValue({ data: [row({ page: page() })], meta: null });
  });

  it('confirms, deletes with the page version, reads the rows again and says so', async () => {
    const user = userEvent.setup();
    render(<LevelPagesCard {...props} />);
    await user.click(await screen.findByRole('button', { name: "More actions for the Bachelor's page" }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete content' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent("Bachelor's in Marine Sciences are removed for good");
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mocks.deleteLevelPage).toHaveBeenCalledWith('subject', 'subject-1', 'lvl-ug', 'v1'));
    await waitFor(() => expect(mocks.listLevelPages).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Bachelor's page content deleted.")).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says why a delete was refused', async () => {
    mocks.deleteLevelPage.mockRejectedValue(Object.assign(new Error('This level page changed in another session. Reload before saving'), { code: 'LEVEL_PAGE_STALE_VERSION' }));
    const user = userEvent.setup();
    render(<LevelPagesCard {...props} />);
    await user.click(await screen.findByRole('button', { name: "More actions for the Bachelor's page" }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete content' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    const toast = await screen.findByText("Bachelor's page: This level page changed in another session. Reload before saving");
    expect(toast.closest('[data-toast-tone]')).toHaveAttribute('data-toast-tone', 'error');
  });

  it('never submits the owner form it sits in', async () => {
    const submitted = vi.fn((event: React.FormEvent) => event.preventDefault());
    const user = userEvent.setup();
    render(<form onSubmit={submitted}><LevelPagesCard {...props} /></form>);
    await user.click(await screen.findByRole('button', { name: "More actions for the Bachelor's page" }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete content' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: "More actions for the Bachelor's page" }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete content' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mocks.deleteLevelPage).toHaveBeenCalledTimes(1));
    expect(submitted).not.toHaveBeenCalled();
  });
});

describe('leaving the owner with unsaved edits', () => {
  it('asks first, and stays when the answer is no', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<LevelPagesCard {...props} parentDirty />);
    await user.click(await screen.findByRole('link', { name: "Write the Bachelor's page" }));
    expect(confirm).toHaveBeenCalledWith('Leave this subject without saving your changes?');
    expect(mocks.navigated).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('link', { name: "Write the Bachelor's page" }));
    expect(mocks.navigated).toHaveBeenCalledWith('/subjects/subject-1/level-pages/lvl-ug');
  });

  it('does not ask when nothing is unsaved', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    render(<LevelPagesCard {...props} />);
    await user.click(await screen.findByRole('link', { name: "Write the Bachelor's page" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(mocks.navigated).toHaveBeenCalledTimes(1);
  });
});

describe('coming back from the editor', () => {
  it('shows the editor’s publish confirmation as a green toast', async () => {
    queueFlash({ tone: 'success', message: "Bachelor's in Marine Sciences published successfully." });
    render(<LevelPagesCard {...props} />);
    const toast = await screen.findByText("Bachelor's in Marine Sciences published successfully.");
    expect(toast.closest('[data-toast-tone]')).toHaveAttribute('data-toast-tone', 'success');
  });
});
