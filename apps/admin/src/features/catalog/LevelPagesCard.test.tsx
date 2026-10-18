import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LevelPagesCard } from './LevelPagesCard';
import type { LevelPageRow, LevelRef, MasterRecord } from './catalog.types';
import { clearFlash, queueFlash } from '@/features/shared/Flash';

/**
 * The Level pages card on a subject's or a specialization's editor: one row
 * per level the API says is offered, what each page has, a link to write it,
 * and a way to delete what was written. The rows also follow the study-level
 * ticks above before they are saved: a level ticked shows at once with "Save
 * and write", a level unticked is marked as leaving. It sits inside the
 * owner's <form>, so nothing in it submits that form but "Save and write",
 * which saves the owner on purpose.
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

const ug: LevelRef = { id: 'lvl-ug', code: 'UG', name: "Bachelor's", slug: 'bachelors', description: null, status: 'ACTIVE' };
const pg: LevelRef = { id: 'lvl-pg', code: 'PG', name: "Master's", slug: 'masters', description: null, status: 'ACTIVE' };
const phd: LevelRef = { id: 'lvl-phd', code: 'PHD', name: 'PhD', slug: 'phd', description: null, status: 'ACTIVE' };
/* The active levels the ticks above are drawn from, in their order. */
const master = (level: LevelRef, displayOrder: number): MasterRecord => ({ ...level, displayOrder, createdAt: 'c', updatedAt: 'u' });
const levels = [master(ug, 0), master(pg, 1), master(phd, 2)];
type Page = NonNullable<LevelPageRow['page']>;
const page = (overrides: Partial<Page> = {}): Page => ({
  id: 'page-1', status: 'DRAFT', hasIntro: true, hasStudyTopics: false, hasAdmissionNote: false, hasCareersNote: false, hasIndustries: false, hasEmployers: false, hasLookingAhead: false,
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
  levels,
  ticked: ['lvl-ug'],
  savedTicked: ['lvl-ug'],
  basePath: '/subjects/marine-sciences',
  parentDirty: false,
};

/* One level's row, by the name it shows. */
function levelRow(name: string) {
  const found = [...document.querySelectorAll<HTMLElement>('li[data-level-row]')].find((item) => item.dataset.levelRow === name);
  if (!found) throw new Error(`No row for ${name}`);
  return found;
}
const rowNames = () => [...document.querySelectorAll<HTMLElement>('li[data-level-row]')].map((item) => item.dataset.levelRow);

beforeEach(() => {
  clearFlash();
  mocks.listLevelPages.mockResolvedValue({ data: [row()], meta: null });
  mocks.deleteLevelPage.mockResolvedValue({ data: { deleted: true }, meta: null });
});

describe('before the owner is saved', () => {
  it('lists the levels ticked so far from the ticks alone, and reads nothing', () => {
    render(<LevelPagesCard {...props} ownerId={undefined} savedTicked={[]} />);
    expect(screen.getByRole('heading', { name: 'Level pages' })).toBeInTheDocument();
    const bachelors = levelRow("Bachelor's");
    expect(within(bachelors).getByText('/subjects/marine-sciences/bachelors')).toBeInTheDocument();
    expect(within(bachelors).getByText('Not saved yet')).toBeInTheDocument();
    expect(within(bachelors).getByText('Ticked here')).toBeInTheDocument();
    const save = within(bachelors).getByRole('button', { name: "Save and write the Bachelor's page" });
    expect(save).toHaveTextContent(/^Save and write$/);
    /* No editor to link to and nothing written to delete until it is saved. */
    expect(within(bachelors).queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button', { name: /More actions/ })).toBeNull();
    expect(screen.queryByText(/Save the subject first/)).toBeNull();
    expect(mocks.listLevelPages).not.toHaveBeenCalled();
  });

  it('says when nothing is ticked yet, naming the owner', () => {
    const { unmount } = render(<LevelPagesCard {...props} ownerId={undefined} ticked={[]} savedTicked={[]} />);
    expect(
      screen.getByText('No study level is ticked yet. Tick a level under Study levels above and it shows here; “Save and write” saves the subject and opens its page.'),
    ).toBeInTheDocument();
    unmount();

    render(<LevelPagesCard {...props} owner="specialization" ownerId={undefined} ticked={[]} savedTicked={[]} />);
    expect(screen.getByText(/“Save and write” saves the specialization and opens its page\./)).toBeInTheDocument();
    expect(mocks.listLevelPages).not.toHaveBeenCalled();
  });

  it('shows no address while the new record has no slug', () => {
    render(<LevelPagesCard {...props} ownerId={undefined} savedTicked={[]} basePath={null} />);
    const bachelors = levelRow("Bachelor's");
    expect(within(bachelors).getByRole('button', { name: "Save and write the Bachelor's page" })).toBeInTheDocument();
    expect(bachelors).not.toHaveTextContent('/subjects/');
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
    render(<LevelPagesCard {...props} ticked={['lvl-ug', 'lvl-phd']} savedTicked={['lvl-ug', 'lvl-phd']} />);
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
    render(<LevelPagesCard {...props} ticked={[]} savedTicked={[]} />);
    expect(
      await screen.findByText('No study level is offered yet. Tick a level under Study levels above and it shows here, ready to write; a level with a published course shows here on its own.'),
    ).toBeInTheDocument();
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

  it('says what “Not saved yet” means only while a tick differs from the saved one', async () => {
    const hint = 'Rows marked “Not saved yet” follow your study level ticks. Saving keeps them; “Save and write” saves and opens the page.';
    const { unmount } = render(<LevelPagesCard {...props} />);
    await screen.findByRole('link', { name: "Write the Bachelor's page" });
    expect(screen.queryByText(hint)).toBeNull();
    expect(screen.queryByText('Not saved yet')).toBeNull();
    unmount();

    render(<LevelPagesCard {...props} ticked={['lvl-ug', 'lvl-phd']} />);
    expect(await screen.findByText(hint)).toBeInTheDocument();
    expect(screen.queryByText('Study level changes show here after you save.')).toBeNull();
  });
});

describe('following the study-level ticks before they are saved', () => {
  it('shows a level just ticked at once, with a button that saves and opens its page', async () => {
    render(<LevelPagesCard {...props} ownerPublished ticked={['lvl-ug', 'lvl-phd']} />);
    await screen.findByRole('link', { name: "Write the Bachelor's page" });
    const phdRow = levelRow('PhD');
    expect(within(phdRow).getByText('Not saved yet')).toBeInTheDocument();
    expect(within(phdRow).getByText('/subjects/marine-sciences/phd')).toBeInTheDocument();
    expect(within(phdRow).getByText('Ticked here')).toBeInTheDocument();
    /* Nothing is written for it yet, and saying so beside "Not saved yet"
       would be noise; it is not on the site, so there is nothing to view. */
    expect(within(phdRow).queryByText('Not written')).toBeNull();
    expect(within(phdRow).queryByRole('link')).toBeNull();
    const save = within(phdRow).getByRole('button', { name: 'Save and write the PhD page' });
    expect(save).toHaveAttribute('type', 'submit');
    expect(save).toHaveAttribute('name', 'intent');
    expect(save).toHaveAttribute('value', 'write:lvl-phd');
    expect(save).toHaveTextContent(/^Save and write$/);
    /* The saved level is untouched by it. */
    expect(within(levelRow("Bachelor's")).queryByText('Not saved yet')).toBeNull();
    expect(within(levelRow("Bachelor's")).getByRole('link', { name: /View on site/ })).toBeInTheDocument();
  });

  it('places a level just ticked in the levels’ own order', async () => {
    mocks.listLevelPages.mockResolvedValue({ data: [row(), row({ level: phd, path: '/subjects/marine-sciences/phd' })], meta: null });
    render(<LevelPagesCard {...props} ticked={['lvl-ug', 'lvl-phd', 'lvl-pg']} savedTicked={['lvl-ug', 'lvl-phd']} />);
    await screen.findByRole('button', { name: "Save and write the Master's page" });
    expect(rowNames()).toEqual(["Bachelor's", "Master's", 'PhD']);
  });

  it('names a specialization on the button', async () => {
    render(<LevelPagesCard {...props} owner="specialization" ownerId="spec-1" ticked={['lvl-ug', 'lvl-phd']} basePath="/subjects/marine-sciences/marine-biology" />);
    const save = await screen.findByRole('button', { name: 'Save and write the PhD page' });
    expect(save).toHaveAttribute('value', 'write:lvl-phd');
    expect(within(levelRow('PhD')).getByText('/subjects/marine-sciences/marine-biology/phd')).toBeInTheDocument();
  });

  it('submits the owner’s form with the level it is for', async () => {
    let submitter = '';
    const submitted = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submitter = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value ?? '';
    });
    const user = userEvent.setup();
    render(<form onSubmit={submitted}><LevelPagesCard {...props} ticked={['lvl-ug', 'lvl-phd']} /></form>);
    await user.click(await screen.findByRole('button', { name: 'Save and write the PhD page' }));
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(submitter).toBe('write:lvl-phd');
  });

  it('marks a written level unticked, and offered only by its tick, as going off the site', async () => {
    mocks.listLevelPages.mockResolvedValue({ data: [row({ page: page() })], meta: null });
    render(<LevelPagesCard {...props} ownerPublished ticked={[]} />);
    /* Its page stays listed after the save, as "Not offered now", so it is
       not struck out of the list. */
    expect(await screen.findByText('Off the site when you save')).toBeInTheDocument();
    expect(screen.queryByText('Removed when you save')).toBeNull();
    const bachelors = levelRow("Bachelor's");
    expect(within(bachelors).getByText("Bachelor's")).not.toHaveClass('line-through');
    expect(within(bachelors).getByText('Unticked. Its page goes off the site when you save; what is written is kept.')).toBeInTheDocument();
    /* What was written can still be opened and deleted; it can't be viewed
       on the site, nor saved-and-written. */
    expect(within(bachelors).getByRole('link', { name: "Edit the Bachelor's page" })).toBeInTheDocument();
    expect(within(bachelors).queryByRole('link', { name: /View on site/ })).toBeNull();
    expect(within(bachelors).queryByRole('button', { name: /^Save and / })).toBeNull();
    expect(within(bachelors).queryByText('Ticked here')).toBeNull();
    expect(within(bachelors).getByRole('button', { name: "More actions for the Bachelor's page" })).toBeInTheDocument();
    /* No row carries "Not saved yet", so the hint about it stays away. */
    expect(screen.queryByText(/Rows marked “Not saved yet” follow your study level ticks/)).toBeNull();
  });

  it('says a leaving level with nothing written simply leaves the list', async () => {
    render(<LevelPagesCard {...props} ticked={[]} />);
    expect(await screen.findByText('Unticked. It leaves this list when you save.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: "Write the Bachelor's page" })).toBeNull();
  });

  it('keeps a level a specialization also offers, whatever its tick', async () => {
    mocks.listLevelPages.mockResolvedValue({ data: [row({ sources: ['TICKED', 'SPECIALIZATION'] })], meta: null });
    render(<LevelPagesCard {...props} ticked={[]} />);
    const link = await screen.findByRole('link', { name: "Write the Bachelor's page" });
    expect(link).toHaveAttribute('href', '/subjects/subject-1/level-pages/lvl-ug');
    const bachelors = levelRow("Bachelor's");
    expect(within(bachelors).getByText('From a specialization')).toBeInTheDocument();
    expect(within(bachelors).queryByText(/Ticked here/)).toBeNull();
    expect(within(bachelors).getByText('Not saved yet')).toBeInTheDocument();
    expect(screen.queryByText('Removed when you save')).toBeNull();
  });

  it('offers to save and edit a kept page whose level is ticked again', async () => {
    mocks.listLevelPages.mockResolvedValue({
      data: [row(), row({ level: phd, offered: false, sources: [], path: '/subjects/marine-sciences/phd', page: page({ id: 'page-2' }) })],
      meta: null,
    });
    render(<LevelPagesCard {...props} ticked={['lvl-ug', 'lvl-phd']} />);
    const save = await screen.findByRole('button', { name: 'Save and edit the PhD page' });
    expect(save).toHaveTextContent(/^Save and edit$/);
    expect(save).toHaveAttribute('value', 'write:lvl-phd');
    const phdRow = levelRow('PhD');
    expect(within(phdRow).getByText('Ticked again. Its page is back on the site when you save.')).toBeInTheDocument();
    expect(within(phdRow).getByText('Not saved yet')).toBeInTheDocument();
    expect(within(phdRow).getByText('Draft')).toBeInTheDocument();
    expect(within(phdRow).queryByText('Not offered now')).toBeNull();
    expect(within(phdRow).queryByRole('link', { name: 'Edit the PhD page' })).toBeNull();
    expect(within(phdRow).getByRole('button', { name: 'More actions for the PhD page' })).toBeInTheDocument();
  });

  it('stays as the API sent it while the level list could not be read', async () => {
    render(<LevelPagesCard {...props} levels={[]} ticked={['lvl-phd']} />);
    expect(await screen.findByRole('link', { name: "Write the Bachelor's page" })).toBeInTheDocument();
    expect(screen.queryByText('Not saved yet')).toBeNull();
    expect(screen.queryByText('Removed when you save')).toBeNull();
    expect(rowNames()).toEqual(["Bachelor's"]);
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
