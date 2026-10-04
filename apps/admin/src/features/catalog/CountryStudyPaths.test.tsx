import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A destination's study paths are typed here and nowhere else.
 *
 * The public guide printed four levels on every country page from a list in
 * the web app -- on a country nobody had filled in, in words nobody could
 * edit. The list is now this card: empty until an editor adds to it, and the
 * guide shows exactly what it holds.
 */

const mocks = vi.hoisted(() => ({
  listContinents: vi.fn(),
  listEditorialMedia: vi.fn(),
  listCountryFeatures: vi.fn(),
  listCountryEnglishTests: vi.fn(),
  listAllSubjects: vi.fn(),
  listCountryTags: vi.fn(),
  getCountry: vi.fn(),
  getCountryEditorial: vi.fn(),
  getCountryCurationOptions: vi.fn(),
  getCountryProfiles: vi.fn(),
  listIntakeOptions: vi.fn(),
  updateCountry: vi.fn(),
  createCountry: vi.fn(),
  createSubject: vi.fn(),
  publishCountry: vi.fn(),
  unpublishCountry: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('./catalog-client', async (original) => ({
  ...(await original<typeof import('./catalog-client')>()),
  ...mocks,
}));

const { CountryForm } = await import('./CountryForm');

const country = {
  id: 'country-1',
  name: 'Malta',
  slug: 'malta',
  pageHeading: 'Study in Malta',
  shortDescription: '<p>English-taught degrees.</p>',
  continent: { id: 'continent-1', name: 'Europe', slug: 'europe' },
  externalUid: null,
  overview: null,
  tagline: null,
  iso2Code: 'MT',
  iso3Code: 'MLT',
  capitalCity: 'Valletta',
  officialLanguage: null,
  currencyName: 'Euro',
  currency: { code: 'EUR', symbol: '€' },
  flagMediaId: null,
  listingMediaId: null,
  heroMediaId: null,
  featured: false,
  displayOrder: 18,
  subjectIds: [],
  tagIds: [],
  configuration: null as unknown,
  status: 'DRAFT',
  updatedAt: new Date('2026-09-06T00:00:00Z').toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  const meta = { page: 1, limit: 50, total: 0, totalPages: 0 };
  mocks.listContinents.mockResolvedValue({ data: [country.continent], meta });
  mocks.listEditorialMedia.mockResolvedValue({ data: [], meta });
  mocks.listCountryFeatures.mockResolvedValue({ data: [], meta: null });
  mocks.listCountryEnglishTests.mockResolvedValue({ data: [], meta: null });
  mocks.listAllSubjects.mockResolvedValue([]);
  mocks.listCountryTags.mockResolvedValue({ data: [], meta });
  mocks.getCountry.mockResolvedValue({ data: country });
  mocks.getCountryEditorial.mockResolvedValue({
    data: { sections: [], faqs: [], seo: null, consultantCards: [], media: [] },
  });
  mocks.getCountryCurationOptions.mockResolvedValue({ data: { universities: [], courses: [] } });
  mocks.getCountryProfiles.mockResolvedValue({ data: {} });
  mocks.listIntakeOptions.mockResolvedValue({ data: [] });
  mocks.updateCountry.mockResolvedValue({ data: country });
});

async function openEditor() {
  render(<CountryForm countryId="country-1" />);
  await waitFor(() => expect(screen.getByDisplayValue('Malta')).toBeVisible());
}

const save = async () => {
  await userEvent.click(screen.getByRole('button', { name: /save draft/i }));
  await waitFor(() => expect(mocks.updateCountry).toHaveBeenCalled());
  return mocks.updateCountry.mock.calls[0][1] as { studyPaths: Array<Record<string, unknown>> };
};

describe('the study paths card', () => {
  it('starts empty and says the guide will leave the section out', async () => {
    await openEditor();
    expect(screen.getByRole('heading', { name: 'Study paths' })).toBeVisible();
    expect(screen.getByText(/No study paths listed/)).toBeVisible();
    expect(screen.queryByLabelText('Level name')).toBeNull();
  });

  it('sends an empty list when there are none, which is what clears the section', async () => {
    await openEditor();
    const payload = await save();
    expect(payload.studyPaths).toEqual([]);
  });

  it('fills the four usual levels only when asked, and they can then be edited', async () => {
    await openEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Fill the four usual levels' }));

    const names = screen.getAllByLabelText('Level name').map((el) => (el as HTMLInputElement).value);
    expect(names).toEqual(["Bachelor's", "Master's", 'MBA', 'PhD']);

    const durations = screen.getAllByLabelText('Typical duration');
    await userEvent.clear(durations[0]);
    await userEvent.type(durations[0], '3 years (4 in Scotland)');

    const payload = await save();
    expect(payload.studyPaths).toHaveLength(4);
    expect(payload.studyPaths[0]).toMatchObject({
      name: "Bachelor's",
      duration: '3 years (4 in Scotland)',
      entry: 'School leaving qualification',
    });
  });

  it('stops offering the four once they are all there', async () => {
    await openEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Fill the four usual levels' }));
    expect(screen.queryByRole('button', { name: 'Fill the four usual levels' })).toBeNull();
  });

  it('adds the missing ones beside a level already written, without a second copy of it', async () => {
    mocks.getCountry.mockResolvedValue({
      data: {
        ...country,
        configuration: {
          features: [],
          acceptedTests: [],
          intakeMonths: [],
          postStudyWorkPermitMonths: null,
          calculator: null,
          studyPaths: [
            { name: "Bachelor's", duration: '3 years', entry: 'A-levels', summary: null },
          ],
        },
      },
    });
    await openEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Fill the four usual levels' }));

    const names = screen.getAllByLabelText('Level name').map((el) => (el as HTMLInputElement).value);
    expect(names).toEqual(["Bachelor's", "Master's", 'MBA', 'PhD']);
    /* The row that was there keeps what its editor wrote. */
    expect((screen.getAllByLabelText('Typical duration')[0] as HTMLInputElement).value).toBe('3 years');
  });

  it('loads the saved levels and sends them back as they were', async () => {
    mocks.getCountry.mockResolvedValue({
      data: {
        ...country,
        configuration: {
          features: [],
          acceptedTests: [],
          intakeMonths: [],
          postStudyWorkPermitMonths: null,
          calculator: null,
          studyPaths: [
            { name: 'Foundation year', duration: '1 year', entry: null, summary: 'A bridge into a degree.' },
          ],
        },
      },
    });
    await openEditor();
    expect(screen.getByLabelText('Level name')).toHaveValue('Foundation year');

    const payload = await save();
    expect(payload.studyPaths).toEqual([
      { name: 'Foundation year', duration: '1 year', entry: undefined, summary: 'A bridge into a degree.' },
    ]);
  });

  it('adds a level by hand, and drops a row that was never named', async () => {
    await openEditor();
    await userEvent.click(screen.getByRole('button', { name: '+ Add level' }));
    await userEvent.click(screen.getByRole('button', { name: '+ Add level' }));
    const names = screen.getAllByLabelText('Level name');
    await userEvent.type(names[0], 'Diploma');

    const payload = await save();
    expect(payload.studyPaths).toEqual([
      { name: 'Diploma', duration: undefined, entry: undefined, summary: undefined },
    ]);
  });

  it('removes a level', async () => {
    await openEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Fill the four usual levels' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove MBA' }));

    const names = screen.getAllByLabelText('Level name').map((el) => (el as HTMLInputElement).value);
    expect(names).toEqual(["Bachelor's", "Master's", 'PhD']);
  });
});
