import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CountryForm } from './CountryForm';

/**
 * Work and visa values entered on an existing Country vanished when the record
 * was reopened.
 *
 * The reproduction runs the author's actual sequence against a fake API that
 * stores what it is given and hands it straight back, so a value that is
 * missing after the reopen was lost inside the editor rather than by the
 * server. Each assertion names the hop it is pinning down: what the editor put
 * in the payload, what the server was left holding, and what a freshly mounted
 * form rendered from it.
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

const record = {
  id: 'country-india',
  name: 'India',
  slug: 'india',
  pageHeading: 'Study in India',
  shortDescription: 'Short',
  continent: { id: 'continent-asia', name: 'Asia', slug: 'asia' },
  externalUid: null,
  overview: null,
  tagline: null,
  iso2Code: 'IN',
  iso3Code: null,
  capitalCity: 'New Delhi',
  officialLanguage: null,
  currencyName: 'Indian Rupee',
  currency: { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  flagMediaId: null,
  listingMediaId: null,
  heroMediaId: null,
  featured: false,
  displayOrder: 0,
  subjectIds: [],
  tagIds: [],
  configuration: null,
  status: 'DRAFT',
  updatedAt: new Date('2026-09-11T00:00:00Z').toISOString(),
};

/** What the fake server is holding. Mirrors the real bundle shape. */
let stored: {
  cost: Record<string, unknown> | null;
  work: Record<string, unknown> | null;
  language: Record<string, unknown> | null;
  statistics: Record<string, unknown> | null;
};
/** Every payload the editor sent, so the payload hop can be asserted directly. */
let sent: Array<{ section: string; payload: Record<string, unknown> }>;

beforeEach(() => {
  vi.clearAllMocks();
  stored = { cost: null, work: null, language: null, statistics: null };
  sent = [];

  const meta = { page: 1, limit: 50, total: 0, totalPages: 0 };
  mocks.listContinents.mockResolvedValue({ data: [record.continent], meta });
  mocks.listEditorialMedia.mockResolvedValue({ data: [], meta });
  mocks.listCountryFeatures.mockResolvedValue({ data: [], meta: null });
  mocks.listCountryEnglishTests.mockResolvedValue({ data: [], meta: null });
  mocks.listAllSubjects.mockResolvedValue([]);
  mocks.listIntakeOptions.mockResolvedValue({ data: [] });
  mocks.getCountryCurationOptions.mockResolvedValue({
    data: { universities: [], courses: [] },
  });
  mocks.getCountryEditorial.mockResolvedValue({
    data: { sections: [], faqs: [], seo: null, consultantCards: [], media: [] },
  });
  mocks.getCountry.mockResolvedValue({ data: record });
  mocks.updateCountry.mockResolvedValue({ data: record });
  mocks.createCountry.mockResolvedValue({ data: record });

  /* Stores the payload the way the API does: the version token is consumed
   * rather than persisted, and everything else is written and handed back. */
  mocks.putCountryProfile.mockImplementation(
    async (_id: string, section: string, payload: Record<string, unknown>) => {
      sent.push({ section, payload });
      /* The version token is consumed by the write rather than stored, exactly
       * as the API treats it. */
      const fields = { ...payload };
      delete fields.expectedUpdatedAt;
      stored[section as keyof typeof stored] = {
        ...fields,
        updatedAt: new Date().toISOString(),
      };
      return { data: stored[section as keyof typeof stored] };
    },
  );
  mocks.getCountryProfiles.mockImplementation(async () => ({
    data: { ...stored, derivedUniversitiesCount: 0, intakes: [] },
  }));
});

async function openCountry() {
  const view = render(<CountryForm countryId={record.id} />);
  await waitFor(() =>
    expect(screen.getByLabelText(/^Country name/)).toHaveValue('India'),
  );
  /* The profile cards mount behind their own fetch, so waiting only for the
   * identity section would assert against a form that is still loading. */
  await waitFor(() =>
    expect(screen.getByLabelText(/^Visa type/)).toBeVisible(),
  );
  return view;
}

/** The four kinds the acceptance criteria name, filled the way an author does. */
async function fillWorkAndVisa() {
  await userEvent.type(screen.getByLabelText(/^Visa type/), 'Student Visa (S)');
  await userEvent.click(
    screen.getByLabelText(/^Part-time work allowed during study/),
  );
  await userEvent.type(screen.getByLabelText(/^Work hours per week/), '20');

  const summary = screen.getByRole('textbox', { name: 'Part-time work summary' });
  summary.innerHTML = '<p>Stamp 2 permits twenty hours a week in term time.</p>';
  await userEvent.type(summary, ' ');
}

describe('work and visa survives save and reopen', () => {
  it('sends every filled field in the save payload', async () => {
    await openCountry();
    await fillWorkAndVisa();

    await userEvent.click(screen.getByRole('button', { name: /Save work and visa/i }));

    await waitFor(() => expect(sent).toHaveLength(1));
    const payload = sent[0].payload;
    expect(sent[0].section).toBe('work');
    expect(payload.visaType).toBe('Student Visa (S)');
    expect(payload.partTimeAllowed).toBe(true);
    expect(payload.partTimeHoursPerWeek).toBe('20');
    expect(String(payload.partTimeSummary)).toContain('twenty hours a week');
  });

  it('still shows the values after the country is reopened', async () => {
    const first = await openCountry();
    await fillWorkAndVisa();
    await userEvent.click(screen.getByRole('button', { name: /Save work and visa/i }));
    await waitFor(() => expect(stored.work).not.toBeNull());

    // Reopen: the editor is torn down and mounted again against the same server.
    first.unmount();
    await openCountry();

    await waitFor(() =>
      expect(screen.getByLabelText(/^Visa type/)).toHaveValue('Student Visa (S)'),
    );
    expect(screen.getByLabelText(/^Part-time work allowed during study/)).toBeChecked();
    expect(screen.getByLabelText(/^Work hours per week/)).toHaveValue(20);
    expect(
      screen.getByRole('textbox', { name: 'Part-time work summary' }),
    ).toHaveAttribute(
      'data-rte-value',
      expect.stringContaining('twenty hours a week') as unknown as string,
    );
  });

  it('keeps an edit made after the reopen', async () => {
    const first = await openCountry();
    await fillWorkAndVisa();
    await userEvent.click(screen.getByRole('button', { name: /Save work and visa/i }));
    await waitFor(() => expect(stored.work).not.toBeNull());
    first.unmount();

    await openCountry();
    await waitFor(() =>
      expect(screen.getByLabelText(/^Visa type/)).toHaveValue('Student Visa (S)'),
    );
    await userEvent.clear(screen.getByLabelText(/^Visa type/));
    await userEvent.type(screen.getByLabelText(/^Visa type/), 'e-Student Visa');
    await userEvent.click(screen.getByRole('button', { name: /Save work and visa/i }));
    await waitFor(() => expect(stored.work?.visaType).toBe('e-Student Visa'));

    const second = screen.getByLabelText(/^Visa type/);
    expect(second).toHaveValue('e-Student Visa');
  });
});

describe('the form save button and the profile cards', () => {
  it('writes work and visa when the author uses the country Save draft button', async () => {
    await openCountry();
    await fillWorkAndVisa();

    /* The author does not press the card's own Save; they press the one at the
     * end of the form, which is the control that says it saves the country. */
    await userEvent.click(screen.getByRole('button', { name: /^Save draft$/i }));

    await waitFor(() => expect(mocks.updateCountry).toHaveBeenCalled());
    expect(stored.work).not.toBeNull();
    expect(stored.work?.visaType).toBe('Student Visa (S)');
  });
});

describe('the other profile cards behave the same way', () => {
  it('writes cost, English and statistics edits through the country save', async () => {
    await openCountry();

    await userEvent.type(screen.getByLabelText(/^Tuition minimum/), '25000');
    await userEvent.selectOptions(
      screen.getByLabelText(/^IELTS requirement/),
      'OPTIONAL',
    );
    await userEvent.type(
      screen.getByLabelText(/^International students/),
      '58134',
    );

    await userEvent.click(screen.getByRole('button', { name: /^Save draft$/i }));
    await waitFor(() => expect(mocks.updateCountry).toHaveBeenCalled());

    expect(stored.cost?.tuitionMin).toBe('25000');
    expect(stored.language?.ieltsRequirement).toBe('OPTIONAL');
    expect(stored.statistics?.internationalStudentsCount).toBe('58134');
  });

  it('leaves a card the author never touched alone', async () => {
    await openCountry();
    await fillWorkAndVisa();

    await userEvent.click(screen.getByRole('button', { name: /^Save draft$/i }));
    await waitFor(() => expect(stored.work).not.toBeNull());

    /* Only the edited card is written. Rewriting the other three would bump
     * their version tokens and, on a country two people are editing, would
     * hand one of them a stale-version failure they did nothing to cause. */
    expect(sent.map((row) => row.section)).toEqual(['work']);
    expect(stored.cost).toBeNull();
    expect(stored.language).toBeNull();
    expect(stored.statistics).toBeNull();
  });

  it('marks the form dirty when only a profile field changed', async () => {
    await openCountry();
    await userEvent.type(screen.getByLabelText(/^Visa type/), 'Student Visa (S)');

    /* The unsaved-changes guard is the form's, so a profile-only edit has to
     * reach it -- otherwise the author is told nothing before navigating away. */
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('legacy source and verification values', () => {
  it('round-trips a stored source reference the editor no longer shows', async () => {
    /* Rows written before the source-verification workflow was withdrawn still
     * carry both columns. The controls are gone, so the only way they survive
     * an ordinary edit is for the card to hand back what it was given. */
    stored.work = {
      visaType: 'Student Visa (S)',
      sourceReference: 'https://boi.gov.in/legacy',
      verifiedAt: '2026-01-02T00:00:00.000Z',
      updatedAt: new Date('2026-09-11T00:00:00Z').toISOString(),
    };

    await openCountry();
    expect(screen.queryByLabelText(/^Source reference/)).toBeNull();
    expect(screen.queryByLabelText(/^Verified on/)).toBeNull();

    await userEvent.type(screen.getByLabelText(/^Visa processing time/), '8 weeks');
    await userEvent.click(screen.getByRole('button', { name: /Save work and visa/i }));
    await waitFor(() => expect(sent).toHaveLength(1));

    expect(sent[0].payload.sourceReference).toBe('https://boi.gov.in/legacy');
    expect(sent[0].payload.verifiedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(stored.work?.visaProcessingTime).toBe('8 weeks');
  });
});

/**
 * One card the server refuses must not cost the author the other three.
 *
 * The flush wrote the cards in a plain loop with a single `await`, so the first
 * rejection threw out of the whole thing and the cards behind it were never
 * sent. In production that is exactly what happened: a cost note longer than
 * the contract allowed came back 400, and work, English and statistics -- all
 * valid, all filled in -- were never attempted. The country row itself had
 * already been written, so the author was left with a saved country, four empty
 * profile cards and no idea which field had done it.
 */
describe('a profile card the server refuses', () => {
  it('does not stop the other cards from being written', async () => {
    mocks.putCountryProfile.mockImplementation(
      async (_id: string, section: string, payload: Record<string, unknown>) => {
        if (section === 'cost')
          throw Object.assign(new Error('tuitionNotes must be shorter'), {
            code: 'VALIDATION_ERROR',
            status: 400,
            details: null,
          });
        sent.push({ section, payload });
        const fields = { ...payload };
        delete fields.expectedUpdatedAt;
        stored[section as keyof typeof stored] = {
          ...fields,
          updatedAt: new Date().toISOString(),
        };
        return { data: stored[section as keyof typeof stored] };
      },
    );

    await openCountry();
    await userEvent.type(screen.getByLabelText(/^Tuition minimum/), '25000');
    await fillWorkAndVisa();
    await userEvent.selectOptions(
      screen.getByLabelText(/^IELTS requirement/),
      'OPTIONAL',
    );
    await userEvent.type(screen.getByLabelText(/^International students/), '58134');

    await userEvent.click(screen.getByRole('button', { name: /^Save draft$/i }));
    await waitFor(() => expect(mocks.updateCountry).toHaveBeenCalled());

    /* The three valid cards are on the server. */
    await waitFor(() => expect(stored.work).not.toBeNull());
    expect(stored.work?.visaType).toBe('Student Visa (S)');
    expect(stored.language?.ieltsRequirement).toBe('OPTIONAL');
    expect(stored.statistics?.internationalStudentsCount).toBe('58134');
    /* The one the server refused is not, and says so. */
    expect(stored.cost).toBeNull();
  });

  it('names the card and the server’s reason', async () => {
    mocks.putCountryProfile.mockImplementation(
      async (_id: string, section: string) => {
        if (section === 'cost')
          throw Object.assign(new Error('tuitionNotes must be shorter'), {
            code: 'VALIDATION_ERROR',
            status: 400,
            details: null,
          });
        return { data: {} };
      },
    );

    await openCountry();
    await userEvent.type(screen.getByLabelText(/^Tuition minimum/), '25000');
    await userEvent.click(screen.getByRole('button', { name: /^Save draft$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Cost and budget');
    expect(alert.textContent).toContain('tuitionNotes must be shorter');
  });

  it('keeps the refused card pending so a corrected save retries it', async () => {
    let refuse = true;
    mocks.putCountryProfile.mockImplementation(
      async (_id: string, section: string, payload: Record<string, unknown>) => {
        if (section === 'cost' && refuse)
          throw Object.assign(new Error('tuitionNotes must be shorter'), {
            code: 'VALIDATION_ERROR',
            status: 400,
            details: null,
          });
        sent.push({ section, payload });
        const fields = { ...payload };
        delete fields.expectedUpdatedAt;
        stored[section as keyof typeof stored] = {
          ...fields,
          updatedAt: new Date().toISOString(),
        };
        return { data: stored[section as keyof typeof stored] };
      },
    );

    await openCountry();
    await userEvent.type(screen.getByLabelText(/^Tuition minimum/), '25000');
    await userEvent.click(screen.getByRole('button', { name: /^Save draft$/i }));
    await screen.findByRole('alert');
    expect(stored.cost).toBeNull();

    /* The author fixes whatever the server objected to and saves again. The
     * card is still counted as edited, so it goes out this time -- and it
     * still carries the value they typed before the refusal. */
    refuse = false;
    await userEvent.click(screen.getByRole('button', { name: /^Save draft$/i }));
    await waitFor(() => expect(stored.cost).not.toBeNull());
    expect(stored.cost?.tuitionMin).toBe('25000');
  });
});

/**
 * The sequence production actually ran, which nothing covered.
 *
 * Every case above opens an existing country. The failure was reported on a
 * country being created: the editor renders the profile cards before there is
 * an id to hang them on, the author fills them in, and the country's own save
 * creates the row and then flushes the cards against the id it just got back.
 */
describe('profile cards filled while the country is still being created', () => {
  it('writes them with the save that creates the country', async () => {
    render(<CountryForm />);
    await waitFor(() =>
      expect(screen.getByLabelText(/^Visa type/)).toBeVisible(),
    );

    await userEvent.type(screen.getByLabelText(/^Country name/), 'India');
    await fillWorkAndVisa();
    await userEvent.type(screen.getByLabelText(/^Tuition minimum/), '25000');

    await userEvent.click(screen.getByRole('button', { name: /^Save draft$/i }));

    await waitFor(() => expect(mocks.createCountry).toHaveBeenCalled());
    await waitFor(() => expect(stored.work).not.toBeNull());
    expect(stored.work?.visaType).toBe('Student Visa (S)');
    expect(stored.cost?.tuitionMin).toBe('25000');
  });
});
