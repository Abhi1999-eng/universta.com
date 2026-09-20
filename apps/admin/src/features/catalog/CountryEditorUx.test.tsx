import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CountryForm } from './CountryForm';
import { CURRENCY_OPTIONS, flagEmojiFromIso, matchCurrency } from './currency-options';

/**
 * The Country editor became a CMS screen: the name is the only required field,
 * descriptive fields are edited as rich text, and the identity block stopped
 * asking for things it can derive (ISO3, the flag) or does not belong there
 * (display order, a second copy of the currency).
 */

const push = vi.fn();

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
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

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
  configuration: null,
  status: 'DRAFT',
  updatedAt: new Date('2026-09-06T00:00:00Z').toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  const meta = { page: 1, limit: 50, total: 0, totalPages: 0 };
  mocks.listContinents.mockResolvedValue({ data: [country.continent], meta });
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

describe('country editor identity section', () => {
  it('labels the ISO field plainly and no longer asks for ISO3', async () => {
    await openEditor();

    expect(screen.getByLabelText(/^ISO\b/)).toHaveValue('MT');
    /* ISO3 is still on the record and still derived by the API -- it is only
     * the editor that stopped asking for it. */
    expect(screen.queryByLabelText(/ISO3/)).toBeNull();
    expect(screen.queryByLabelText(/ISO2/)).toBeNull();
  });

  it('drops display order from the editor', async () => {
    await openEditor();
    const identity = screen.getByDisplayValue('Malta').closest('form') as HTMLElement;
    expect(within(identity).queryByLabelText('Display order')).toBeNull();
  });

  it('shows the flag as an emoji derived from the ISO code, with nothing to upload', async () => {
    await openEditor();

    expect(screen.getByTestId('country-flag-emoji')).toHaveTextContent('🇲🇹');
    expect(screen.queryByText('Flag image')).toBeNull();
  });

  it('offers currency as three linked selectors that cannot disagree', async () => {
    await openEditor();

    const name = screen.getByLabelText('Currency name') as HTMLSelectElement;
    const code = screen.getByLabelText('Currency code') as HTMLSelectElement;
    const symbol = screen.getByLabelText('Currency symbol') as HTMLSelectElement;
    for (const field of [name, code, symbol]) expect(field.tagName).toBe('SELECT');
    expect(name.value).toBe('EUR');

    await userEvent.selectOptions(symbol, 'GBP');

    /* One choice, three views of it: picking in any of the three moves all
     * three, so "Euro / USD / £" cannot be saved. */
    await waitFor(() => {
      expect(name.value).toBe('GBP');
      expect(code.value).toBe('GBP');
      expect(symbol.value).toBe('GBP');
    });
  });
});

describe('country editor content fields', () => {
  it('edits short description and overview as rich text', async () => {
    await openEditor();

    expect(screen.getByRole('textbox', { name: 'Short description' })).toHaveAttribute('contenteditable', 'true');
    expect(screen.getByRole('textbox', { name: 'Overview' })).toHaveAttribute('contenteditable', 'true');
    expect(screen.getByRole('textbox', { name: 'Short description' })).toHaveTextContent('English-taught degrees.');
  });

  it('keeps structural identity fields as plain inputs', async () => {
    await openEditor();

    for (const label of ['Country name', 'Slug', 'Capital', 'Official language']) {
      const field = screen.getByLabelText(new RegExp(`^${label}`));
      expect(field.tagName).toBe('INPUT');
    }
  });
});

describe('country editor actions', () => {
  it('closes the form with the actions, in normal flow rather than floating', async () => {
    await openEditor();

    const publish = screen.getByRole('button', { name: 'Publish' });
    const bar = publish.parentElement?.parentElement as HTMLElement;
    /* The bar used to float above the form. It sits at the end of the record
     * now, so nothing is covered by it and the last field is reachable. */
    expect(bar.className).not.toContain('sticky');
    expect(bar.className).not.toContain('fixed');
    expect(bar.className).toContain('flex');

    // Last thing in the form: every field and section comes before it.
    const form = publish.closest('form') as HTMLElement;
    expect(form.lastElementChild).toBe(bar);

    // Same row, in the agreed order.
    const row = publish.parentElement as HTMLElement;
    expect(row.className).toContain('flex');
    const labels = within(row).getAllByRole('button').map((button) => button.textContent);
    expect(labels).toEqual(['Save draft', 'Publish']);
  });
});

describe('currency metadata', () => {
  it('derives a flag from any ISO code, and nothing from a bad one', () => {
    expect(flagEmojiFromIso('MT')).toBe('🇲🇹');
    expect(flagEmojiFromIso('gb')).toBe('🇬🇧');
    expect(flagEmojiFromIso('MLT')).toBe('');
    expect(flagEmojiFromIso(null)).toBe('');
  });

  it('matches a stored currency by code, name, or an unambiguous symbol', () => {
    expect(matchCurrency({ code: 'eur' })?.name).toBe('Euro');
    expect(matchCurrency({ name: 'Euro' })?.code).toBe('EUR');
    expect(matchCurrency({ symbol: '€' })?.code).toBe('EUR');
    /* "$" belongs to several currencies; guessing one would silently rewrite
     * the operator's data. */
    expect(matchCurrency({ symbol: '$' })).toBeNull();
    expect(matchCurrency({ code: 'ZZZ' })).toBeNull();
  });

  it('holds one entry per currency code', () => {
    const codes = CURRENCY_OPTIONS.map((row) => row.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(CURRENCY_OPTIONS.every((row) => /^[A-Z]{3}$/.test(row.code) && row.name && row.symbol)).toBe(true);
  });
});

/**
 * The other half of the round trip: HTML already in the database has to come
 * back into the editor as formatting, and go back out sanitised. Codex found
 * eight descriptive fields that had no control at all -- they were stored and
 * published but could only be written by an importer.
 */
describe('profile descriptive fields', () => {
  const STORED = {
    cost: {
      tuitionNotes: '<p>Tuition is <strong>fixed</strong>.</p>',
      disclaimer: '<p>Cost disclaimer.</p>',
    },
    work: {
      immigrationPathwaySummary: '<p>Pathway <em>summary</em>.</p>',
      proofOfFundsSummary: '<ul><li>Bank statement</li></ul>',
      disclaimer: '<p>Work disclaimer.</p>',
    },
    language: {
      pteNotes: '<p>PTE <strong>58</strong>.</p>',
      toeflNotes: '<p>TOEFL notes.</p>',
      duolingoNotes: '<p>Duolingo notes.</p>',
      disclaimer: '<p>Language disclaimer.</p>',
    },
  };

  const LABELS = [
    'Tuition notes', 'Living cost notes', 'Cost disclaimer',
    'Part-time work summary', 'Post-study work summary',
    'Immigration pathway summary', 'Visa process', 'Proof of funds summary',
    'Work disclaimer',
    'IELTS notes', 'PTE notes', 'TOEFL notes', 'Duolingo notes',
    'Waiver notes', 'General notes', 'Language disclaimer',
  ];

  it('gives every descriptive profile field a rich-text control', async () => {
    mocks.getCountryProfiles.mockResolvedValue({ data: STORED });
    await openEditor();

    for (const label of LABELS) {
      const field = await screen.findByRole('textbox', { name: label });
      expect(field).toHaveAttribute('contenteditable', 'true');
    }
  });

  it('loads stored HTML back as formatting rather than as tags', async () => {
    mocks.getCountryProfiles.mockResolvedValue({ data: STORED });
    await openEditor();

    const tuition = await screen.findByRole('textbox', { name: 'Tuition notes' });
    expect(tuition.querySelector('strong')).not.toBeNull();
    expect(tuition).toHaveTextContent('Tuition is fixed.');
    expect(tuition.textContent).not.toContain('<strong>');

    const proof = await screen.findByRole('textbox', { name: 'Proof of funds summary' });
    expect(proof.querySelector('li')).not.toBeNull();

    const pte = await screen.findByRole('textbox', { name: 'PTE notes' });
    expect(pte.querySelector('strong')).not.toBeNull();
  });

  it('leaves scores and requirements as ordinary controls', async () => {
    mocks.getCountryProfiles.mockResolvedValue({ data: STORED });
    await openEditor();

    /* "Verified on" stood here as the date example until the Country
     * source-verification workflow was withdrawn; the profile cards have no
     * date control left. Its absence is asserted below rather than dropped. */
    for (const label of ['Tuition minimum', 'PTE minimum score']) {
      const field = await screen.findAllByLabelText(new RegExp(`^${label}`));
      expect(field[0].tagName).toBe('INPUT');
    }
    const requirement = await screen.findAllByLabelText(/^PTE requirement/);
    expect(requirement[0].tagName).toBe('SELECT');
  });

  it('offers no source reference or verification date on any profile card', async () => {
    mocks.getCountryProfiles.mockResolvedValue({ data: STORED });
    await openEditor();
    await screen.findAllByLabelText(/^Tuition minimum/);

    expect(screen.queryByLabelText(/^Source reference/)).toBeNull();
    expect(screen.queryByLabelText(/^Verified on/)).toBeNull();
  });
});

/**
 * Features and accepted English tests were two literal arrays -- one in this
 * form, one in the API -- so adding either needed a release, and the two copies
 * could drift. They are reusable master data now, and the point of the change
 * is that what an operator adds here is available on every other Country, not
 * just this one.
 */
describe('country editor reusable taxonomies', () => {
  it('offers the options the API holds rather than a list of its own', async () => {
    mocks.listCountryFeatures.mockResolvedValue({
      data: [
        { code: 'BUDGET_FRIENDLY', name: 'Budget friendly', status: 'ACTIVE', displayOrder: 1, isSystem: true },
        { code: 'SCHOLARSHIP_FRIENDLY', name: 'Scholarship friendly', status: 'ACTIVE', displayOrder: 9, isSystem: false },
      ],
      meta: null,
    });
    await openEditor();

    // An option nobody wrote into this file, purely because a row exists.
    expect(screen.getByLabelText('Scholarship friendly')).toBeVisible();
    expect(screen.getByLabelText('Budget friendly')).toBeVisible();
  });

  it('adds a feature as a global option and selects it on this country', async () => {
    mocks.createCountryFeature.mockResolvedValue({
      data: { code: 'SCHOLARSHIP_FRIENDLY', name: 'Scholarship friendly', status: 'ACTIVE', displayOrder: 9, isSystem: false },
    });
    await openEditor();

    await userEvent.type(screen.getByLabelText('Add a feature'), 'Scholarship friendly');
    await userEvent.click(screen.getByRole('button', { name: 'Add a feature' }));

    /* Only the name is sent: the code is derived by the API, so the Admin
     * cannot mint a second code meaning the same thing. */
    expect(mocks.createCountryFeature).toHaveBeenCalledWith({ name: 'Scholarship friendly' });
    await waitFor(() => expect(screen.getByLabelText('Scholarship friendly')).toBeChecked());

    await userEvent.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => expect(mocks.updateCountry).toHaveBeenCalled());
    expect(mocks.updateCountry.mock.calls[0][1].featureCodes).toContain('SCHOLARSHIP_FRIENDLY');
  });

  it('adds an accepted English test the same way', async () => {
    mocks.createCountryEnglishTest.mockResolvedValue({
      data: { code: 'DUOLINGO', name: 'Duolingo', status: 'ACTIVE', displayOrder: 4, isSystem: false },
    });
    await openEditor();

    await userEvent.type(screen.getByLabelText('Add an English test'), 'Duolingo');
    await userEvent.click(screen.getByRole('button', { name: 'Add an English test' }));

    await waitFor(() => expect(screen.getByLabelText('Duolingo')).toBeChecked());
    expect(screen.getByLabelText('IELTS')).not.toBeChecked();
  });

  it('says so rather than silently doing nothing when the option cannot be added', async () => {
    mocks.createCountryFeature.mockRejectedValue(new Error('Super Admin access is required'));
    await openEditor();

    await userEvent.type(screen.getByLabelText('Add a feature'), 'Scholarship friendly');
    await userEvent.click(screen.getByRole('button', { name: 'Add a feature' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Super Admin access is required');
  });
});

/**
 * Subjects are curated here again -- the country guide publishes them as its
 * "Popular subjects" section, so an editor needs somewhere to say which fields
 * a destination is known for. Tags stayed out, and a save must still not clear
 * what is already related: importers and the public country page both depend
 * on those rows.
 */
describe('country editor subject and tag pickers', () => {
  it('offers a Subject picker and still no Tag picker', async () => {
    await openEditor();

    expect(await screen.findByTestId('country-subjects')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Tags$/ })).toBeNull();
    expect(screen.queryByText('+ Add tag')).toBeNull();
  });

  /* The point of bringing the picker back: a change an editor makes has to
     reach the payload, not just survive the round trip. */
  it('saves a subject the editor assigns', async () => {
    mocks.listAllSubjects.mockResolvedValue([
      { id: 'subject-1', name: 'Engineering', slug: 'engineering', status: 'ACTIVE' },
    ]);
    await openEditor();

    await userEvent.click(await screen.findByRole('checkbox', { name: /Engineering/ }));
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(mocks.updateCountry).toHaveBeenCalled());
    expect(mocks.updateCountry.mock.calls[0][1].subjectIds).toEqual(['subject-1']);
  });

  it('sends the existing mappings back untouched when the country is saved', async () => {
    mocks.getCountry.mockResolvedValue({
      data: { ...country, subjectIds: ['subject-1', 'subject-2'], tagIds: ['tag-1'] },
    });
    await openEditor();

    await userEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(mocks.updateCountry).toHaveBeenCalled());
    const payload = mocks.updateCountry.mock.calls[0][1];
    expect(payload.subjectIds).toEqual(['subject-1', 'subject-2']);
    expect(payload.tagIds).toEqual(['tag-1']);
  });
});

/**
 * Country is a CMS record: the name is the only thing an author must supply.
 * Everything else is content filled in over time, and a red asterisk beside a
 * field nothing will ever ask for is a false instruction.
 */
describe('country editor required marker', () => {
  it('marks the country name and nothing else', async () => {
    await openEditor();

    /* Field markers only. The SEO block also prints an asterisk inside a
     * sentence explaining that its own two fields become required once any
     * SEO value is entered -- that is a rule about a part-filled section, not
     * a Country field demanded on an empty form. */
    const marked = screen
      .getAllByText('*')
      .map((mark) => mark.closest('label'))
      .filter((label): label is HTMLLabelElement => label !== null)
      .map((label) => label.textContent);
    expect(marked).toEqual(['Country name *']);
  });
});

/**
 * The section key stopped being a chosen one. The public page has dedicated
 * renderers for a set of conventional keys and falls back to the section type
 * for anything else, so limiting authors to that set never protected the
 * rendering -- it only stopped them naming their own sections.
 */
describe('country editor section key', () => {
  it('takes any key as free text, and starts a new section blank', async () => {
    await openEditor();

    await userEvent.click(screen.getByRole('button', { name: /add section/i }));
    const key = await screen.findByLabelText(/^Section key/);

    expect(key.tagName).toBe('INPUT');
    expect(key).toHaveValue('');

    await userEvent.type(key, 'my-own-section');
    expect(key).toHaveValue('my-own-section');
  });

  it('loads a stored key back for editing, whatever it is', async () => {
    mocks.getCountryEditorial.mockResolvedValue({
      data: {
        sections: [
          {
            id: 'section-1',
            sectionKey: 'a-key-nobody-listed',
            sectionType: 'RICH_TEXT',
            eyebrow: null,
            heading: 'Section heading',
            subheading: null,
            bodyJson: { paragraphs: ['Body.'] },
            primaryMedia: null,
            secondaryMedia: null,
            ctaLabel: null,
            ctaUrl: null,
            configurationJson: null,
            displayOrder: 0,
            status: 'ACTIVE',
            createdAt: '',
            updatedAt: '',
          },
        ],
        faqs: [],
        seo: null,
        consultantCards: [],
        media: [],
      },
    });
    await openEditor();

    expect(await screen.findByLabelText(/^Section key/)).toHaveValue('a-key-nobody-listed');
  });
});

/**
 * Featured is not an author's decision, so the control is gone -- but the value
 * is not. A country that is already featured has to stay featured through an
 * ordinary save, or editing a tagline would quietly drop it off the public
 * `?featured=` listing.
 */
describe('country editor featured', () => {
  it('does not offer a Featured control', async () => {
    await openEditor();

    expect(screen.queryByLabelText('Featured')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Featured' })).toBeNull();
  });

  it('sends the stored value back untouched when the country is saved', async () => {
    mocks.getCountry.mockResolvedValue({ data: { ...country, featured: true } });
    await openEditor();

    await userEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(mocks.updateCountry).toHaveBeenCalled());
    expect(mocks.updateCountry.mock.calls[0][1].isFeatured).toBe(true);
  });
});
