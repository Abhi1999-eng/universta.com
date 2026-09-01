import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CountryTaxonomyPicker,
  findExistingTerm,
  termSlug,
  type CreateOutcome,
  type TaxonomyRow,
} from './CountryTaxonomyPicker';
import { CountriesPage } from './CountriesPage';

/**
 * The picker lives inside the Country form, so the tests that matter are the
 * ones about not losing work: creating a term must not submit or reset the
 * surrounding form, and an existing term must be selected rather than
 * duplicated.
 */

const mocks = vi.hoisted(() => ({
  listContinents: vi.fn(),
  listCountries: vi.fn(),
  listSubjects: vi.fn(),
  listCountryTags: vi.fn(),
  createContinent: vi.fn(),
  updateContinent: vi.fn(),
  deleteContinent: vi.fn(),
  publishCountry: vi.fn(),
  unpublishCountry: vi.fn(),
  deleteCountry: vi.fn(),
}));
vi.mock('./catalog-client', () => mocks);
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const SUBJECTS: TaxonomyRow[] = [
  {
    id: 'engineering',
    label: 'Engineering',
    usage: 12,
    children: [{ id: 'cs', label: 'Computer Science' }],
  },
  { id: 'nursing', label: 'Nursing', usage: 3 },
  { id: 'it', label: 'Information Technology', usage: 7 },
];

function Harness({
  onCreate,
  initial = [],
}: {
  onCreate?: (name: string) => Promise<CreateOutcome>;
  initial?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  // The real form appends the created term to its options; the harness has to
  // do the same or the new row has nothing to render.
  const [rows, setRows] = useState<TaxonomyRow[]>(SUBJECTS);
  return (
    // A real surrounding form, because the point is that the dialog must not
    // submit it.
    <form onSubmit={(event) => { event.preventDefault(); }} data-testid="outer-form">
      <input aria-label="Country name" defaultValue="" />
      <CountryTaxonomyPicker
        title="Subjects"
        singular="Subject"
        testId="subjects"
        rows={rows}
        selected={selected}
        onChange={setSelected}
        onCreate={async (name) => {
          const outcome = onCreate
            ? await onCreate(name)
            : ({ kind: 'created', id: `new-${name}`, label: name } as CreateOutcome);
          setRows((current) =>
            current.some((row) => row.id === outcome.id)
              ? current
              : [...current, { id: outcome.id, label: outcome.label }],
          );
          return outcome;
        }}
      />
    </form>
  );
}

describe('country taxonomy picker', () => {
  it('normalises names and slugs the way the catalogue does', () => {
    expect(termSlug('  Computer   Science ')).toBe('computer-science');
    expect(findExistingTerm(SUBJECTS, 'engineering')?.id).toBe('engineering');
    expect(findExistingTerm(SUBJECTS, '  ENGINEERING  ')?.id).toBe('engineering');
    expect(findExistingTerm(SUBJECTS, 'Marine Biology')).toBeUndefined();
  });

  it('checks the subjects already assigned to the country', () => {
    render(<Harness initial={['engineering', 'nursing']} />);
    expect(screen.getByRole('checkbox', { name: /Engineering/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Nursing/ })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /Information Technology/ }),
    ).not.toBeChecked();
  });

  it('selects and deselects a subject', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const nursing = screen.getByRole('checkbox', { name: /Nursing/ });
    await user.click(nursing);
    expect(nursing).toBeChecked();
    await user.click(nursing);
    expect(nursing).not.toBeChecked();
  });

  it('shows sub-subjects beneath their parent without making them selectable', () => {
    render(<Harness />);
    expect(screen.getByText('Computer Science')).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: /Computer Science/ }),
    ).not.toBeInTheDocument();
  });

  it('filters to the selected subjects only', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['nursing']} />);
    await user.click(screen.getByRole('button', { name: /Selected/ }));
    expect(screen.getByRole('checkbox', { name: /Nursing/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: /Engineering/ }),
    ).not.toBeInTheDocument();
  });

  it('searches by subject name and by sub-subject label', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const search = screen.getByLabelText('Search subjects');
    await user.type(search, 'nurs');
    expect(screen.getByRole('checkbox', { name: /Nursing/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: /Engineering/ }),
    ).not.toBeInTheDocument();

    await user.clear(search);
    // A sub-subject match keeps its parent visible, because the parent is what
    // gets assigned.
    await user.type(search, 'computer');
    expect(screen.getByRole('checkbox', { name: /Engineering/ })).toBeInTheDocument();
  });

  it('orders the most used view by real usage', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /Most used/ }));
    const labels = screen
      .getAllByRole('checkbox')
      .map((box) => box.closest('label')?.textContent ?? '');
    expect(labels[0]).toContain('Engineering');
    expect(labels[1]).toContain('Information Technology');
    expect(labels[2]).toContain('Nursing');
  });

  it('creates a new subject, auto-selects it and leaves the country form untouched', async () => {
    const user = userEvent.setup();
    const create = vi.fn(async (name: string) => ({
      kind: 'created' as const,
      id: 'marine',
      label: name,
    }));
    render(<Harness onCreate={create} />);

    const nameField = screen.getByLabelText('Country name');
    await user.type(nameField, 'Unsaved country name');

    await user.click(screen.getByRole('button', { name: '+ Add New Subject' }));
    await user.type(screen.getByLabelText('Subject name'), 'Marine Biology');
    await user.click(screen.getByRole('button', { name: /Create subject/i }));

    await waitFor(() => expect(create).toHaveBeenCalledWith('Marine Biology'));
    expect(screen.getByRole('checkbox', { name: /Marine Biology/ })).toBeChecked();
    // The unsaved country field survived the whole exchange.
    expect(nameField).toHaveValue('Unsaved country name');
  });

  it('selects an existing subject instead of creating a duplicate', async () => {
    const user = userEvent.setup();
    const create = vi.fn();
    render(<Harness onCreate={create as never} />);
    await user.click(screen.getByRole('button', { name: '+ Add New Subject' }));
    await user.type(screen.getByLabelText('Subject name'), '  engineering ');
    await user.click(screen.getByRole('button', { name: /Create subject/i }));

    expect(create).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: /Engineering/ })).toBeChecked();
    expect(screen.getByRole('status').textContent).toContain('already existed');
  });

  it('never submits the surrounding country form from the dialog', async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={submit} data-testid="outer">
        <CountryTaxonomyPicker
          title="Subjects"
          singular="Subject"
          rows={SUBJECTS}
          selected={[]}
          onChange={() => undefined}
          onCreate={async (name) => ({ kind: 'created', id: 'x', label: name })}
        />
      </form>,
    );
    await user.click(screen.getByRole('button', { name: '+ Add New Subject' }));

    // The dialog sits inside the outer form and contains no form of its own,
    // which is what stops its button from submitting the country.
    const dialog = screen.getByRole('dialog');
    expect(dialog.closest('form')?.getAttribute('data-testid')).toBe('outer');
    expect(dialog.querySelector('form')).toBeNull();

    // Enter inside the dialog would submit the outer form if the browser
    // default were left in place. It creates the term and closes instead.
    await user.type(screen.getByLabelText('Subject name'), 'Something New{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(submit).not.toHaveBeenCalled();
  });

  it('surfaces a creation failure without closing the dialog', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        onCreate={async () => {
          throw new Error('Subject name or slug already exists');
        }}
      />,
    );
    await user.click(screen.getByRole('button', { name: '+ Add New Subject' }));
    await user.type(screen.getByLabelText('Subject name'), 'Brand New Thing');
    await user.click(screen.getByRole('button', { name: /Create subject/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('already exists'),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

const meta = { page: 1, limit: 12, total: 1, totalPages: 1 };
const countryRow = {
  id: 'country-1',
  name: 'Australia',
  slug: 'australia',
  pageHeading: 'Study in Australia',
  shortDescription: 'Core record',
  continent: { id: 'c1', name: 'Oceania', slug: 'oceania' },
  flag: null,
  featured: false,
  displayOrder: 1,
  statistics: null,
  iso2Code: 'AU',
  iso3Code: 'AUS',
  status: 'PUBLISHED',
  updatedAt: new Date().toISOString(),
  subjects: [
    { id: 's1', name: 'Computer Science', slug: 'computer-science' },
    { id: 's2', name: 'Engineering', slug: 'engineering' },
    { id: 's3', name: 'Nursing', slug: 'nursing' },
  ],
  tags: [{ id: 't1', name: 'Popular', slug: 'popular' }],
  linkedCounts: { universities: 2, courses: 18, scholarships: 3 },
};

describe('countries list taxonomy columns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listContinents.mockResolvedValue({ data: [], meta });
    mocks.listSubjects.mockResolvedValue({
      data: [{ id: 's2', name: 'Engineering', slug: 'engineering' }],
      meta,
    });
    mocks.listCountryTags.mockResolvedValue({
      data: [{ id: 't1', name: 'Popular', slug: 'popular' }],
      meta,
    });
    mocks.listCountries.mockResolvedValue({ data: [countryRow], meta });
  });

  it('renders assigned subjects, tags and linked record counts', async () => {
    render(<CountriesPage />);
    await waitFor(() => expect(screen.getByText('Australia')).toBeInTheDocument());
    // Two labels plus an overflow marker keeps the row scannable.
    const row = screen.getByText('Australia').closest('tr') as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('Computer Science, Engineering +1');
    expect(row.textContent).toContain('Popular');
    expect(row.textContent).toContain(
      '2 universities · 18 courses · 3 scholarships',
    );
  });

  it('sends the subject filter to the list API', async () => {
    const user = userEvent.setup();
    render(<CountriesPage />);
    await waitFor(() => expect(mocks.listCountries).toHaveBeenCalled());
    await user.selectOptions(screen.getByLabelText('Filter by subject'), 's2');
    await waitFor(() =>
      expect(
        mocks.listCountries.mock.calls.at(-1)?.[0],
      ).toMatchObject({ subjectId: 's2' }),
    );
  });

  it('sends the tag filter to the list API', async () => {
    const user = userEvent.setup();
    render(<CountriesPage />);
    await waitFor(() => expect(mocks.listCountries).toHaveBeenCalled());
    await user.selectOptions(screen.getByLabelText('Filter by tag'), 't1');
    await waitFor(() =>
      expect(mocks.listCountries.mock.calls.at(-1)?.[0]).toMatchObject({
        tagId: 't1',
      }),
    );
  });
});
