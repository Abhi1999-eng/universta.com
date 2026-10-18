import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogMastersPage, levelUsageLine } from './CatalogMastersPage';

/**
 * The study levels list: one list every subject, specialization, course and
 * programme ticks, so it says what it is, where each level is used, and
 * keeps a level's code -- its pages' address -- fixed once the level exists.
 * Study modes share the screen and keep their editable codes.
 */

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  listCourseLevels: vi.fn(),
  listStudyModes: vi.fn(),
  createCourseLevel: vi.fn(),
  updateCourseLevel: vi.fn(),
  deleteCourseLevel: vi.fn(),
  createStudyMode: vi.fn(),
  updateStudyMode: vi.fn(),
  deleteStudyMode: vi.fn(),
}));
vi.mock('./catalog-client', () => mocks);
vi.mock('next/navigation', () => ({
  useSearchParams: () => mocks.params,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/catalog-masters',
}));
vi.mock('@/features/auth/auth-client', () => ({
  authFetch: vi.fn(async () => new Response(JSON.stringify({ data: [], error: null }), { status: 200 })),
}));
vi.mock('./ScholarshipProvidersPanel', () => ({ ScholarshipProvidersPanel: () => null }));

const meta = { page: 1, limit: 100, total: 2, totalPages: 1 };
const master = (patch: Record<string, unknown>) => ({
  description: null,
  educationOrder: 0,
  displayOrder: 0,
  status: 'ACTIVE',
  createdAt: 'c',
  updatedAt: 'v1',
  ...patch,
});
const pg = master({
  id: 'lvl-pg',
  code: 'PG',
  name: "Master's",
  description: 'A postgraduate degree.',
  slug: 'masters',
  usage: { subjects: 3, specializations: 2, courses: 6, programmes: 4, levelPages: 2 },
});
const diploma = master({
  id: 'lvl-diploma',
  code: 'DIPLOMA',
  name: 'Diploma',
  slug: 'diploma',
  usage: { subjects: 0, specializations: 0, courses: 0, programmes: 0, levelPages: 0 },
});
const online = master({ id: 'mode-online', code: 'ONLINE', name: 'Online', description: 'At home.' });

function at(section: string) {
  mocks.params = new URLSearchParams({ section });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listCourseLevels.mockResolvedValue({ data: [pg, diploma], meta });
  mocks.listStudyModes.mockResolvedValue({ data: [online], meta });
  mocks.updateCourseLevel.mockResolvedValue(pg);
  mocks.createCourseLevel.mockResolvedValue(pg);
  mocks.updateStudyMode.mockResolvedValue(online);
});

describe('levelUsageLine', () => {
  it('names each place a level is used, in the singular for one', () => {
    expect(levelUsageLine({ subjects: 3, specializations: 2, courses: 6, programmes: 4, levelPages: 2 })).toBe(
      'Used in 3 subjects · 2 specializations · 6 courses · 4 programmes · 2 written level pages',
    );
    expect(levelUsageLine({ subjects: 1, specializations: 0, courses: 1, programmes: 0, levelPages: 0 })).toBe(
      'Used in 1 subject · 1 course',
    );
    expect(levelUsageLine({ subjects: 0, specializations: 0, courses: 0, programmes: 0, levelPages: 0 })).toBe('Not used yet');
    expect(levelUsageLine(undefined)).toBeNull();
  });
});

describe('the study levels section', () => {
  it('says what the list is, and where each level is used', async () => {
    at('course-levels');
    render(<CatalogMastersPage />);
    expect(screen.getByRole('heading', { level: 2, name: 'Study levels' })).toBeInTheDocument();
    expect(screen.getByText(/The one list of study levels that subjects, specializations/)).toBeInTheDocument();
    expect(screen.queryByText(/The lists that course editors pick from/)).not.toBeInTheDocument();
    const usage = await screen.findAllByTestId('level-usage');
    expect(usage.map((line) => line.textContent)).toEqual([
      'Used in 3 subjects · 2 specializations · 6 courses · 4 programmes · 2 written level pages',
      'Not used yet',
    ]);
  });

  it("locks a level's code on edit and leaves it out of the save", async () => {
    at('course-levels');
    const user = userEvent.setup();
    render(<CatalogMastersPage />);
    await screen.findByText("Master's");
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Edit study level' });
    expect(within(dialog).getByText('The code is fixed once saved. The name, description and order can change any time.')).toBeInTheDocument();
    const code = within(dialog).getByRole('textbox', { name: /Code/ });
    expect(code).toHaveAttribute('readonly');
    expect(code).toHaveValue('PG');
    expect(within(dialog).getByText('Locked. Level page addresses use it: /subjects/…/masters. Change the name instead.')).toBeInTheDocument();
    await user.type(code, 'X');
    expect(code).toHaveValue('PG');
    const name = within(dialog).getByRole('textbox', { name: /Name/ });
    await user.clear(name);
    await user.type(name, 'Masters');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(mocks.updateCourseLevel).toHaveBeenCalledTimes(1);
    const [id, body] = mocks.updateCourseLevel.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe('lvl-pg');
    expect(body).not.toHaveProperty('code');
    expect(body).toMatchObject({ name: 'Masters', description: 'A postgraduate degree.', expectedUpdatedAt: 'v1' });
  });

  it("clears an emptied level description, and caps it at the API's 500", async () => {
    at('course-levels');
    const user = userEvent.setup();
    render(<CatalogMastersPage />);
    await screen.findByText("Master's");
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Edit study level' });
    const description = within(dialog).getByRole('textbox', { name: /Description/ });
    expect(description).toHaveAttribute('maxlength', '500');
    expect(within(dialog).getByText(/Shown on this level's pages, and in the level section/)).toBeInTheDocument();
    await user.clear(description);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(mocks.updateCourseLevel.mock.calls[0][1]).toMatchObject({ description: null });
  });

  it('lets a new level take any code, and says it is fixed after', async () => {
    at('course-levels');
    const user = userEvent.setup();
    render(<CatalogMastersPage />);
    await screen.findByText("Master's");
    await user.click(screen.getByRole('button', { name: 'Add' }));
    const dialog = screen.getByRole('dialog', { name: 'Add study level' });
    const code = within(dialog).getByRole('textbox', { name: /Code/ });
    expect(code).not.toHaveAttribute('readonly');
    expect(within(dialog).getByText("Can't be changed after you save. Level page addresses are built from it.")).toBeInTheDocument();
    await user.type(code, 'cert');
    await user.type(within(dialog).getByRole('textbox', { name: /Name/ }), 'Certificate');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(mocks.createCourseLevel.mock.calls[0][0]).toMatchObject({ code: 'CERT', name: 'Certificate' });
  });
});

describe('the other masters keep their own ways', () => {
  it.each([
    ['study-modes', 'Study modes'],
    ['intakes', 'Intakes'],
    ['scholarship-providers', 'Scholarship providers'],
  ])('%s keeps its heading and line', async (section, heading) => {
    at(section);
    render(<CatalogMastersPage />);
    expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    expect(screen.getByText(/The lists that course editors pick from/)).toBeInTheDocument();
    expect(screen.queryByText(/The one list of study levels/)).not.toBeInTheDocument();
  });

  it("keeps a study mode's code editable, with no usage line", async () => {
    at('study-modes');
    const user = userEvent.setup();
    render(<CatalogMastersPage />);
    await screen.findByText('Online');
    expect(screen.queryByTestId('level-usage')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit study mode' });
    expect(within(dialog).getByText('Use stable codes because courses and integrations reference them.')).toBeInTheDocument();
    const code = within(dialog).getByRole('textbox', { name: /Code/ });
    expect(code).not.toHaveAttribute('readonly');
    expect(within(dialog).queryByText(/Level page addresses/)).not.toBeInTheDocument();
    const description = within(dialog).getByRole('textbox', { name: /Description/ });
    expect(description).not.toHaveAttribute('maxlength');
    await user.clear(code);
    await user.type(code, 'REMOTE');
    await user.clear(description);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    const body = mocks.updateStudyMode.mock.calls[0][1] as Record<string, unknown>;
    expect(body).toMatchObject({ code: 'REMOTE' });
    expect(body.description).toBeUndefined();
  });
});
