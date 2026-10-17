import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CountryForm } from './CountryForm';
import { clearFlash, peekFlash } from '@/features/shared/Flash';

/**
 * Publishing ends the editing session, so it leaves the editor for the list
 * and hands the confirmation over. Saving a draft is the middle of one, so it
 * confirms in place. Before this, both ended silently on the editor: the
 * operator published a country and got no acknowledgement at all, and had no
 * way to tell a successful publish from a save that had quietly gone nowhere.
 */

const push = vi.fn();
const replace = vi.fn();

const mocks = vi.hoisted(() => ({
  listContinents: vi.fn(),
  listEditorialMedia: vi.fn(),
  listAllSubjects: vi.fn(),
  listCountryTags: vi.fn(),
  listCountryFeatures: vi.fn(),
  listCountryEnglishTests: vi.fn(),
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
  createSubject: vi.fn(),
  createCountryTag: vi.fn(),
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
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/', }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const draft = {
  id: 'country-1',
  name: 'Malta',
  slug: 'malta',
  pageHeading: 'Study in Malta',
  shortDescription: 'English-taught degrees in the EU.',
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
  configuration: null,
  status: 'DRAFT',
  updatedAt: new Date('2026-09-05T00:00:00Z').toISOString(),
};
const published = { ...draft, status: 'PUBLISHED' };

function seed(record: typeof draft) {
  vi.clearAllMocks();
  clearFlash();
  const meta = { page: 1, limit: 50, total: 0, totalPages: 0 };
  mocks.listContinents.mockResolvedValue({ data: [record.continent], meta });
  mocks.listEditorialMedia.mockResolvedValue({ data: [], meta });
  /* Features and accepted English tests are master data the form reads rather
   * than a list it carries, so the editor cannot load without them. */
  mocks.listCountryFeatures.mockResolvedValue({
    data: [
      { code: 'BUDGET_FRIENDLY', name: 'Budget friendly', status: 'ACTIVE', displayOrder: 1, isSystem: true },
    ],
    meta: null,
  });
  mocks.listCountryEnglishTests.mockResolvedValue({
    data: [{ code: 'IELTS', name: 'IELTS', status: 'ACTIVE', displayOrder: 1, isSystem: true }],
    meta: null,
  });
  mocks.listAllSubjects.mockResolvedValue([]);
  mocks.listCountryTags.mockResolvedValue({ data: [], meta });
  mocks.getCountry.mockResolvedValue({ data: record });
  mocks.getCountryEditorial.mockResolvedValue({
    data: { sections: [], faqs: [], seo: null, consultantCards: [], media: [] },
  });
  mocks.getCountryCurationOptions.mockResolvedValue({
    data: { universities: [], courses: [] },
  });
  mocks.getCountryProfiles.mockResolvedValue({ data: {} });
  mocks.listIntakeOptions.mockResolvedValue({ data: [] });
  mocks.updateCountry.mockResolvedValue({ data: record });
}

async function openEditor() {
  render(<CountryForm countryId="country-1" />);
  await waitFor(() => expect(screen.getByDisplayValue('Malta')).toBeVisible());
}

describe('country editor save and publish flow', () => {
  beforeEach(() => seed(draft));

  it('leaves for the list and hands over a green confirmation on publish', async () => {
    mocks.publishCountry.mockResolvedValue({ data: published });
    await openEditor();

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/countries'));
    expect(replace).not.toHaveBeenCalled();
    expect(peekFlash()).toMatchObject({
      tone: 'success',
      message: 'Malta published successfully.',
    });
  });

  it('stays in the editor and confirms a saved draft in neutral grey', async () => {
    await openEditor();

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    const banner = await screen.findByText('Draft saved.');
    expect(banner.closest('[data-flash-tone]')).toHaveAttribute('data-flash-tone', 'neutral');
    expect(push).not.toHaveBeenCalled();
    expect(peekFlash()).toBeNull();
  });

  it('says a published country was moved to draft, and stays put', async () => {
    seed(published);
    mocks.unpublishCountry.mockResolvedValue({ data: draft });
    mocks.getCountry.mockResolvedValue({ data: published });
    await openEditor();

    await userEvent.click(screen.getByRole('button', { name: 'Move to draft' }));

    const banner = await screen.findByText('Country moved to draft.');
    expect(banner.closest('[data-flash-tone]')).toHaveAttribute('data-flash-tone', 'neutral');
    expect(push).not.toHaveBeenCalled();
  });

  it('lets the operator dismiss a draft confirmation', async () => {
    await openEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved.');

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss message' }));

    expect(screen.queryByText('Draft saved.')).toBeNull();
  });

  it('does not redirect, confirm or lose typed data when a publish fails', async () => {
    mocks.updateCountry.mockRejectedValue({
      code: 'COUNTRY_SLUG_CONFLICT',
      message: 'Invalid catalog request',
    });
    await openEditor();
    const tagline = screen.getByLabelText(/Tagline/);
    await userEvent.type(tagline, 'Mediterranean campus');

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() =>
      expect(screen.getByText('That slug is already used by another country.')).toBeVisible(),
    );
    expect(push).not.toHaveBeenCalled();
    expect(peekFlash()).toBeNull();
    expect(screen.queryByText(/published successfully/)).toBeNull();
    expect(screen.queryByText('Draft saved.')).toBeNull();
    expect(tagline).toHaveValue('Mediterranean campus');
  });

  it('does not redirect or confirm when a draft save fails', async () => {
    mocks.updateCountry.mockRejectedValue({ message: 'Catalog service unavailable' });
    await openEditor();

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Catalog service unavailable'),
    );
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByText('Draft saved.')).toBeNull();
  });

  /* Enter in a text field clicked the form's first submit button -- Move to
     draft, on a live country -- and took it off the site. */
  it('saves nothing when Enter is pressed in a text field of a published country', async () => {
    seed(published);
    mocks.getCountry.mockResolvedValue({ data: published });
    mocks.unpublishCountry.mockResolvedValue({ data: draft });
    await openEditor();

    await userEvent.type(screen.getByLabelText(/Tagline/), 'Mediterranean campus{Enter}');
    await userEvent.type(screen.getByDisplayValue('Malta'), '{Enter}');
    expect(mocks.updateCountry).not.toHaveBeenCalled();
    expect(mocks.unpublishCountry).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Move to draft' }));
    expect(await screen.findByText('Country moved to draft.')).toBeInTheDocument();
    expect(mocks.updateCountry).toHaveBeenCalledTimes(1);
    expect(mocks.updateCountry.mock.calls[0][1]).toMatchObject({ tagline: 'Mediterranean campus' });
  });
});
