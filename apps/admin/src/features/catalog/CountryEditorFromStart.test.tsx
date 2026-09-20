import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CountryForm } from './CountryForm';

/**
 * A new Country used to show about half an editor: profiles and intakes were
 * replaced by "Save this Country first", so an author could not see what they
 * would eventually be asked for, let alone fill it in while they had the
 * information in front of them.
 *
 * Publish decides what the public sees. It does not decide what the Admin can
 * look at. Every section renders from the first keystroke; the sections that
 * genuinely need a persisted parent hold their values locally and are written
 * as soon as the country exists.
 */

const push = vi.fn();
const replace = vi.fn();

const mocks = vi.hoisted(() => ({
  listContinents: vi.fn(),
  listEditorialMedia: vi.fn(),
  listCountryFeatures: vi.fn(),
  listCountryEnglishTests: vi.fn(),
  listAllSubjects: vi.fn(),
  createCountryFeature: vi.fn(),
  createCountryEnglishTest: vi.fn(),
  getCountry: vi.fn(),
  getCountryEditorial: vi.fn(),
  getCountryCurationOptions: vi.fn(),
  getCountryProfiles: vi.fn(),
  listIntakeOptions: vi.fn(),
  updateCountry: vi.fn(),
  createCountry: vi.fn(),
  publishCountry: vi.fn(),
  unpublishCountry: vi.fn(),
  saveCountrySeo: vi.fn(),
  deleteCountrySeo: vi.fn(),
  createContinent: vi.fn(),
  createConsultantCard: vi.fn(),
  updateConsultantCard: vi.fn(),
  deleteConsultantCard: vi.fn(),
  createCountryFaq: vi.fn(),
  updateCountryFaq: vi.fn(),
  deleteCountryFaq: vi.fn(),
  createEditorialSection: vi.fn(),
  updateEditorialSection: vi.fn(),
  deleteEditorialSection: vi.fn(),
  putCountryProfile: vi.fn(),
}));
vi.mock('./catalog-client', () => mocks);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, refresh: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const created = {
  id: 'country-new',
  name: 'Malta',
  slug: 'malta',
  pageHeading: '',
  shortDescription: '',
  continent: { id: 'continent-1', name: 'Europe', slug: 'europe' },
  externalUid: null,
  overview: null,
  tagline: null,
  iso2Code: null,
  iso3Code: null,
  capitalCity: null,
  officialLanguage: null,
  currencyName: null,
  currency: null,
  flagMediaId: null,
  listingMediaId: null,
  heroMediaId: null,
  featured: false,
  displayOrder: 0,
  subjectIds: [],
  tagIds: [],
  configuration: null,
  status: 'DRAFT',
  updatedAt: new Date('2026-09-09T00:00:00Z').toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  const meta = { page: 1, limit: 50, total: 0, totalPages: 0 };
  mocks.listContinents.mockResolvedValue({ data: [created.continent], meta });
  mocks.listEditorialMedia.mockResolvedValue({ data: [], meta });
  mocks.listCountryFeatures.mockResolvedValue({
    data: [{ code: 'BUDGET_FRIENDLY', name: 'Budget friendly', status: 'ACTIVE', displayOrder: 1, isSystem: true }],
    meta: null,
  });
  mocks.listCountryEnglishTests.mockResolvedValue({
    data: [{ code: 'IELTS', name: 'IELTS', status: 'ACTIVE', displayOrder: 1, isSystem: true }],
    meta: null,
  });
  mocks.listAllSubjects.mockResolvedValue([]);
  mocks.listIntakeOptions.mockResolvedValue({
    data: [{ id: 'intake-fall', name: 'Fall', slug: 'fall' }],
  });
  mocks.getCountryProfiles.mockResolvedValue({ data: {} });
  mocks.getCountryCurationOptions.mockResolvedValue({ data: { universities: [], courses: [] } });
  mocks.getCountryEditorial.mockResolvedValue({
    data: { sections: [], faqs: [], seo: null, consultantCards: [], media: [] },
  });
  mocks.createCountry.mockResolvedValue({ data: created });
  mocks.getCountry.mockResolvedValue({ data: created });
  mocks.putCountryProfile.mockResolvedValue({ data: {} });
});

async function openNewCountry() {
  render(<CountryForm />);
  await waitFor(() => expect(screen.getByLabelText(/^Country name/)).toBeVisible());
}

describe('new country editor visibility', () => {
  it('shows every profile section before the country exists', async () => {
    await openNewCountry();

    /* Intakes are not here: the Country authors them once, as the twelve-month
     * selection in its own configuration card, and the intake module's
     * per-country records left this editor with it. */
    for (const heading of [
      'Cost and budget',
      'Work and visa',
      'English requirements',
      'Statistics',
    ])
      expect(
        screen.getByRole('heading', { name: new RegExp(`^${heading}`) }),
      ).toBeVisible();

    // Not a placeholder standing in for them.
    expect(screen.queryByText(/Save this Country first/i)).toBeNull();
  });

  it('lets a profile field be filled in before the first save', async () => {
    await openNewCountry();

    const tuition = screen.getByLabelText(/^Tuition minimum/);
    await userEvent.type(tuition, '9000');

    expect(tuition).toHaveValue(9000);
    // Nothing is written to the server for a country that does not exist.
    expect(mocks.putCountryProfile).not.toHaveBeenCalled();
    expect(mocks.getCountryProfiles).not.toHaveBeenCalled();
  });

  it('offers the twelve months as the single intake control, and says when each card is saved', async () => {
    await openNewCountry();

    const months = screen.getByRole('group', { name: 'Available intake months' });
    expect(within(months).getAllByRole('checkbox')).toHaveLength(12);
    expect(screen.queryByRole('heading', { name: /^Intakes$/ })).toBeNull();
    expect(
      screen.getAllByText(/Saved with the country the first time you use Save draft/i),
    ).toHaveLength(4);
  });

  it('keeps the curation pickers on screen, disabled, and says why', async () => {
    await openNewCountry();

    for (const title of ['Popular Universities', 'Popular Courses']) {
      const picker = screen.getByRole('group', { name: title });
      expect(picker).toBeVisible();
      expect(
        within(picker).getByText(/Save the country first, then curate/i),
      ).toBeVisible();
    }
  });
});

describe('first save child persistence', () => {
  it('writes the profile drafts against the id the country was just given', async () => {
    await openNewCountry();

    await userEvent.type(screen.getByLabelText(/^Country name/), 'Malta');
    await userEvent.type(screen.getByLabelText(/^Tuition minimum/), '9000');

    await userEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(mocks.createCountry).toHaveBeenCalled());
    await waitFor(() => expect(mocks.putCountryProfile).toHaveBeenCalledTimes(1));

    const [costCall] = mocks.putCountryProfile.mock.calls;
    expect(costCall[0]).toBe('country-new');
    expect(costCall[1]).toBe('cost');
    expect(costCall[2].tuitionMin).toBe('9000');
  });

  it('does not create child records for cards nobody touched', async () => {
    await openNewCountry();

    await userEvent.type(screen.getByLabelText(/^Country name/), 'Malta');
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(mocks.createCountry).toHaveBeenCalled());
    expect(mocks.putCountryProfile).not.toHaveBeenCalled();
  });
});

describe('rich text coverage in the country editor', () => {
  it('edits a document detail as rich text', async () => {
    await openNewCountry();

    await userEvent.click(screen.getByRole('button', { name: '+ Passport' }));

    expect(await screen.findByRole('textbox', { name: 'Details 1' })).toHaveAttribute(
      'aria-multiline',
      'true',
    );
  });

  it('edits an editorial media caption as rich text', async () => {
    await openNewCountry();

    await userEvent.click(screen.getByRole('button', { name: /add section/i }));
    const type = await screen.findByLabelText(/^Section type/);
    await userEvent.selectOptions(type, 'MEDIA');

    expect(
      await screen.findByRole('textbox', { name: 'Media caption' }),
    ).toHaveAttribute('aria-multiline', 'true');
  });

  it('edits a card row description as rich text but leaves a fact value plain', async () => {
    await openNewCountry();

    await userEvent.click(screen.getByRole('button', { name: /add section/i }));
    const type = await screen.findByLabelText(/^Section type/);

    await userEvent.selectOptions(type, 'CARD_GRID');
    expect(await screen.findByRole('textbox', { name: 'Description 1' })).toHaveAttribute(
      'aria-multiline',
      'true',
    );

    /* Cards and steps have one prose box, not two: the old "Value /
     * description" input wrote the same stored key as Description. */
    expect(screen.queryByLabelText(/Value/)).toBeNull();

    await userEvent.selectOptions(type, 'FACT_GRID');
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Description 1' })).toBeNull());
    // A fact's value is a figure, and stays an ordinary input.
    expect((await screen.findByLabelText('Value')).tagName).toBe('INPUT');
  });
});

/**
 * The documents a student needs in hand for a destination. Offered as
 * suggestions so an author starts from a click, but nothing is stored until
 * they add it -- and a destination that asks for something else adds its own.
 */
describe('country documents', () => {
  it('offers suggestions without saving any of them', async () => {
    await openNewCountry();

    expect(screen.getByRole('button', { name: '+ Passport' })).toBeVisible();
    expect(screen.getByRole('button', { name: '+ CV / Resume' })).toBeVisible();
    expect(screen.getByText(/No documents listed/i)).toBeVisible();

    await userEvent.type(screen.getByLabelText(/^Country name/), 'Malta');
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(mocks.createCountry).toHaveBeenCalled());
    expect(mocks.createCountry.mock.calls[0][0].documents).toEqual([]);
  });

  it('adds a suggestion, and stops offering the one already added', async () => {
    await openNewCountry();

    await userEvent.click(screen.getByRole('button', { name: '+ Passport' }));

    expect(screen.getByLabelText(/^Document name/)).toHaveValue('Passport');
    expect(screen.queryByRole('button', { name: '+ Passport' })).toBeNull();
    expect(screen.getByRole('button', { name: '+ CV / Resume' })).toBeVisible();
  });

  it('adds a document nobody suggested, and marks it optional', async () => {
    await openNewCountry();

    await userEvent.click(screen.getByRole('button', { name: '+ Add document' }));
    await userEvent.type(screen.getByLabelText(/^Document name/), 'Police clearance');
    await userEvent.click(screen.getByLabelText('Required'));

    await userEvent.type(screen.getByLabelText(/^Country name/), 'Malta');
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(mocks.createCountry).toHaveBeenCalled());
    expect(mocks.createCountry.mock.calls[0][0].documents).toEqual([
      { name: 'Police clearance', details: undefined, isRequired: false },
    ]);
  });

  it('loads stored documents back for editing', async () => {
    mocks.getCountry.mockResolvedValue({
      data: {
        ...created,
        documents: [
          { id: 'd1', name: 'Passport', details: '<p>Six months validity.</p>', isRequired: true },
        ],
      },
    });
    render(<CountryForm countryId="country-new" />);

    expect(await screen.findByLabelText(/^Document name/)).toHaveValue('Passport');
    expect(await screen.findByRole('textbox', { name: 'Details 1' })).toHaveTextContent(
      'Six months validity.',
    );
  });

  it('removes a document', async () => {
    await openNewCountry();

    await userEvent.click(screen.getByRole('button', { name: '+ Passport' }));
    expect(screen.getByLabelText(/^Document name/)).toHaveValue('Passport');

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByLabelText(/^Document name/)).toBeNull();
    expect(screen.getByRole('button', { name: '+ Passport' })).toBeVisible();
  });
});
