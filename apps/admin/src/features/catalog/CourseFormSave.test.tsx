import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CourseForm } from './CourseForm';
import { clearFlash } from '@/features/shared/Flash';

/**
 * The course editor's own save: the Enter key, a new course's address while
 * a later step can still fail, its SEO -- saved against the version it
 * read, and saved when only a robots tick changed -- and its availability
 * rows, sections and FAQs, each written on its own and kept as it is
 * written, so a retry after a failed one updates rather than adds again.
 */

const push = vi.fn();
const replace = vi.fn();
const mocks = vi.hoisted(() => ({
  createCourse: vi.fn(),
  createCourseFaq: vi.fn(),
  createCourseMapping: vi.fn(),
  createCourseSection: vi.fn(),
  deleteCourseFaq: vi.fn(),
  deleteCourseMapping: vi.fn(),
  deleteCourseSection: vi.fn(),
  deleteCourseSeo: vi.fn(),
  getAdminCourse: vi.fn(),
  getCourseSeo: vi.fn(),
  listAdminCourses: vi.fn(),
  listCountries: vi.fn(),
  listCourseFaqs: vi.fn(),
  listCourseLevels: vi.fn(),
  listCourseMappings: vi.fn(),
  listCourseRelated: vi.fn(),
  listCourseSections: vi.fn(),
  listEditorialMedia: vi.fn(),
  listIntakeOptions: vi.fn(),
  listStudyModes: vi.fn(),
  listAllSubjects: vi.fn(),
  listSubSubjects: vi.fn(),
  publishCourse: vi.fn(),
  replaceCourseIntakes: vi.fn(),
  replaceCourseModes: vi.fn(),
  replaceCourseRelated: vi.fn(),
  saveCourseSeo: vi.fn(),
  unpublishCourse: vi.fn(),
  updateCourse: vi.fn(),
  updateCourseFaq: vi.fn(),
  updateCourseMapping: vi.fn(),
  updateCourseSection: vi.fn(),
  listEvery: vi.fn(),
}));
vi.mock('./catalog-client', () => mocks);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/' }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const level = { id: 'lvl-pg', code: 'PG', name: "Master's", description: null, educationOrder: 4, displayOrder: 0, status: 'ACTIVE', createdAt: 'c', updatedAt: 'u' };
const mode = { id: 'mode-ft', code: 'FT', name: 'Full time', description: null, displayOrder: 0, status: 'ACTIVE', createdAt: 'c', updatedAt: 'u' };
const course = (patch: Record<string, unknown> = {}) => ({
  id: 'course-1',
  subject: { id: 'subject-1', name: 'Marine Sciences', slug: 'marine-sciences', status: 'PUBLISHED' },
  subSubject: null,
  courseLevel: { id: 'lvl-pg', name: "Master's", code: 'PG', status: 'ACTIVE' },
  name: 'MSc Oceanography',
  shortName: null,
  qualificationName: null,
  slug: 'msc-oceanography',
  courseCode: null,
  shortDescription: null,
  overview: null,
  durationMin: null,
  durationMax: null,
  durationUnit: 'YEARS',
  credits: null,
  featuredMedia: null,
  careerSummary: null,
  featured: false,
  popularityScore: null,
  displayOrder: 0,
  status: 'DRAFT',
  publishedAt: null,
  createdAt: 'c',
  updatedAt: 'course-v1',
  studyModes: [mode],
  countries: [],
  contentSections: [],
  faqs: [],
  relatedCourses: [],
  ...patch,
});
const japan = { id: 'country-jp', name: 'Japan', slug: 'japan', status: 'PUBLISHED' };
const mapping = (patch: Record<string, unknown> = {}) => ({
  id: 'map-1', country: japan, availabilityStatus: 'AVAILABLE', indicativeTuitionMin: null, indicativeTuitionMax: null, currencyCode: null, tuitionPeriod: 'PER_YEAR', applicationFeeMin: null, applicationFeeMax: null, durationMinOverride: null, durationMaxOverride: null, durationUnitOverride: null, academicMinPercentage: null, academicMinCgpa: null, ieltsMinScore: null, pteMinScore: null, toeflMinScore: null, duolingoMinScore: null, workExperienceMonths: null, scholarshipAvailable: false, admissionRequirements: null, englishRequirements: null, applicationNotes: null, careerOpportunities: null, sourceReference: null, verifiedAt: null, status: 'ACTIVE', isFeatured: false, displayOrder: 0, updatedAt: 'map-v1', intakes: [],
  ...patch,
});
const section = (id: string, heading: string, updatedAt = `${id}-v1`) => ({ id, sectionKey: 'curriculum', sectionType: 'RICH_TEXT', heading, subheading: null, bodyJson: { paragraphs: [] }, media: null, displayOrder: 0, status: 'ACTIVE', updatedAt });
const faq = (id: string, question: string, updatedAt = `${id}-v1`) => ({ id, question, answer: 'Yes.', displayOrder: 0, status: 'ACTIVE', updatedAt });
const refusal = (message: string, code: string, status = 422) => Object.assign(new Error(message), { code, status, details: null });
const seoRow = (patch: Record<string, unknown> = {}) => ({
  id: 'seo-1', ownerType: 'COURSE', ownerId: 'course-1', seoTitle: null, metaDescription: null, canonicalUrl: null, focusKeyword: null, ogTitle: null, ogDescription: null, ogMediaId: null, twitterTitle: null, twitterDescription: null, twitterMediaId: null, robotsIndex: true, robotsFollow: true, schemaJson: null, hreflangJson: null, ogMedia: null, twitterMedia: null, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  ...patch,
});

beforeEach(() => {
  vi.clearAllMocks();
  clearFlash();
  mocks.listAllSubjects.mockResolvedValue([{ id: 'subject-1', name: 'Marine Sciences', slug: 'marine-sciences', status: 'PUBLISHED' }]);
  mocks.listCourseLevels.mockResolvedValue({ data: [level], meta: null });
  mocks.listStudyModes.mockResolvedValue({ data: [mode], meta: null });
  mocks.listEditorialMedia.mockResolvedValue({ data: [], meta: null });
  mocks.listIntakeOptions.mockResolvedValue({ data: [], meta: null });
  mocks.listEvery.mockResolvedValue([]);
  mocks.listSubSubjects.mockResolvedValue({ data: [], meta: null });
  mocks.getAdminCourse.mockResolvedValue({ data: course() });
  mocks.listCourseMappings.mockResolvedValue({ data: [] });
  mocks.listCourseSections.mockResolvedValue({ data: [] });
  mocks.listCourseFaqs.mockResolvedValue({ data: [] });
  mocks.listCourseRelated.mockResolvedValue({ data: [] });
  mocks.getCourseSeo.mockResolvedValue({ data: null });
  mocks.updateCourse.mockResolvedValue({ data: course({ updatedAt: 'course-v2' }) });
  mocks.replaceCourseModes.mockResolvedValue({ data: course({ updatedAt: 'course-v3' }) });
  mocks.replaceCourseRelated.mockResolvedValue({ data: [] });
  mocks.unpublishCourse.mockResolvedValue({ data: course({ updatedAt: 'course-v4' }) });
});

describe('course editor save flow', () => {
  /* Enter in a text field clicked the form's first submit button -- Move to
     draft, on a live course. */
  it('saves nothing when Enter is pressed in a text field of a published course', async () => {
    mocks.getAdminCourse.mockResolvedValue({ data: course({ status: 'PUBLISHED' }) });
    const user = userEvent.setup();
    render(<CourseForm id="course-1" />);
    await screen.findByRole('button', { name: 'Move to draft' });

    await user.type(screen.getByRole('textbox', { name: /^Course name/ }), ' II{Enter}');
    await user.type(screen.getByRole('textbox', { name: /^Slug/ }), '{Enter}');
    await user.type(screen.getByRole('textbox', { name: /^Course code/ }), '{Enter}');
    expect(mocks.updateCourse).not.toHaveBeenCalled();
    expect(mocks.unpublishCourse).not.toHaveBeenCalled();

    /* Both actions still submit: Publish reaches its own checks, and Move to
       draft saves. */
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Publish requires at least one Available or Limited country mapping.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Move to draft' }));
    await waitFor(() => expect(mocks.unpublishCourse).toHaveBeenCalledTimes(1));
    expect(mocks.updateCourse.mock.calls[0][1]).toMatchObject({ name: 'MSc Oceanography II' });
  });

  /* The course was already adopted once created; its address now follows at
     once too, so a reload after a failed step opens it rather than a blank
     form, and the route itself still waits for the whole save. */
  it('shows a new course at its own address once created, and retries as an update', async () => {
    const addressBar = vi.spyOn(window.history, 'replaceState');
    mocks.createCourse.mockResolvedValue({ data: course({ id: 'course-new', updatedAt: 'new-v1' }) });
    mocks.replaceCourseModes.mockRejectedValueOnce(Object.assign(new Error('Published courses need at least one active study mode'), { code: 'COURSE_STUDY_MODES_INVALID', status: 422, details: null }));
    mocks.getAdminCourse.mockResolvedValue({ data: course({ id: 'course-new', updatedAt: 'new-v2' }) });
    mocks.updateCourse.mockResolvedValue({ data: course({ id: 'course-new', updatedAt: 'new-v3' }) });
    const user = userEvent.setup();
    render(<CourseForm />);
    await screen.findByRole('button', { name: 'Save draft' });
    await user.selectOptions(screen.getByRole('combobox', { name: /^Subject/ }), 'subject-1');
    await user.selectOptions(screen.getByRole('combobox', { name: /^Course level/ }), 'lvl-pg');
    await user.type(screen.getByRole('textbox', { name: /^Course name/ }), 'MSc Oceanography');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('Published courses need at least one active study mode')).toBeInTheDocument();
    expect(addressBar).toHaveBeenCalledWith(null, '', '/courses/course-new');
    expect(replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/courses/course-new'));
    expect(mocks.createCourse).toHaveBeenCalledTimes(1);
    expect(mocks.updateCourse.mock.calls[0][0]).toBe('course-new');
    expect(mocks.updateCourse.mock.calls[0][1]).toMatchObject({ expectedUpdatedAt: 'new-v2' });
  });

  /* The adopted entry holds the Create route under the course's address.
     Pushing the list past it left Back on a blank Create form there; an
     existing course's editor still pushes, so Back returns to it. */
  it('replaces the adopted history entry when a new course is published', async () => {
    mocks.listEvery.mockImplementation(async (list: unknown) => (list === mocks.listCountries ? [japan] : []));
    mocks.createCourse.mockResolvedValue({ data: course({ id: 'course-new', updatedAt: 'new-v1', studyModes: [] }) });
    mocks.replaceCourseModes.mockResolvedValue({ data: course({ id: 'course-new', updatedAt: 'new-v2' }) });
    mocks.createCourseMapping.mockResolvedValue({ data: mapping() });
    mocks.replaceCourseIntakes.mockResolvedValue({ data: [] });
    mocks.getAdminCourse.mockResolvedValue({ data: course({ id: 'course-new', updatedAt: 'new-v3', countries: [mapping()] }) });
    mocks.publishCourse.mockResolvedValue({ data: course({ id: 'course-new', updatedAt: 'new-v4', status: 'PUBLISHED' }) });
    const user = userEvent.setup();
    render(<CourseForm />);
    await screen.findByRole('button', { name: 'Publish' });
    await user.selectOptions(screen.getByRole('combobox', { name: /^Subject/ }), 'subject-1');
    await user.selectOptions(screen.getByRole('combobox', { name: /^Course level/ }), 'lvl-pg');
    await user.type(screen.getByRole('textbox', { name: /^Course name/ }), 'MSc Oceanography');
    await user.click(screen.getByRole('checkbox', { name: 'Full time' }));
    await user.selectOptions(screen.getByRole('combobox', { name: /^Country/ }), 'country-jp');
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/courses'));
    expect(push).not.toHaveBeenCalled();
    expect(mocks.publishCourse).toHaveBeenCalledWith('course-new', 'new-v3');
  });

  it('pushes the list when an existing course is published', async () => {
    mocks.listCourseMappings.mockResolvedValue({ data: [mapping()] });
    mocks.getAdminCourse.mockResolvedValue({ data: course({ countries: [mapping()] }) });
    mocks.updateCourseMapping.mockResolvedValue({ data: mapping({ updatedAt: 'map-v2' }) });
    mocks.replaceCourseIntakes.mockResolvedValue({ data: [] });
    mocks.publishCourse.mockResolvedValue({ data: course({ status: 'PUBLISHED', updatedAt: 'course-v5' }) });
    const user = userEvent.setup();
    render(<CourseForm id="course-1" />);
    await screen.findByRole('button', { name: 'Publish' });
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/courses'));
    expect(replace).not.toHaveBeenCalled();
  });

  /* Unticking "Robots index" alone keeps the course out of search engines;
     it used to be dropped without a word. */
  it('saves robots alone, and sends the SEO version it read each time', async () => {
    mocks.saveCourseSeo
      .mockResolvedValueOnce({ data: seoRow({ robotsIndex: false, updatedAt: '2026-10-17T10:00:00.000Z' }) })
      .mockResolvedValueOnce({ data: seoRow({ robotsIndex: false, updatedAt: '2026-10-17T10:05:00.000Z' }) });
    const user = userEvent.setup();
    render(<CourseForm id="course-1" />);
    await screen.findByRole('button', { name: 'Publish' });

    await user.click(screen.getByRole('checkbox', { name: 'Robots index' }));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.saveCourseSeo).toHaveBeenCalledTimes(1));
    expect(mocks.saveCourseSeo).toHaveBeenLastCalledWith('course-1', { robotsIndex: false, robotsFollow: true, expectedUpdatedAt: null });

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.saveCourseSeo).toHaveBeenCalledTimes(2));
    expect(mocks.saveCourseSeo.mock.calls[1][1]).toMatchObject({ expectedUpdatedAt: '2026-10-17T10:00:00.000Z' });
    expect(mocks.deleteCourseSeo).not.toHaveBeenCalled();
  });

  it('sends the version of the SEO row it loaded, and says when another session changed it', async () => {
    mocks.getCourseSeo.mockResolvedValue({ data: seoRow({ seoTitle: 'MSc Oceanography', metaDescription: 'Study the sea.', updatedAt: '2026-10-02T00:00:00.000Z' }) });
    mocks.saveCourseSeo.mockRejectedValue(Object.assign(new Error('The SEO changed in another session. Reload before saving'), { code: 'SEO_STALE_VERSION', status: 409, details: null }));
    const user = userEvent.setup();
    render(<CourseForm id="course-1" />);
    await screen.findByRole('button', { name: 'Publish' });
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('The SEO changed in another session. Reload before saving')).toBeInTheDocument();
    expect(mocks.saveCourseSeo.mock.calls[0][1]).toMatchObject({ seoTitle: 'MSc Oceanography', expectedUpdatedAt: '2026-10-02T00:00:00.000Z' });
  });

  /* The FAQs are written one by one after the course. When the second is
     refused the first already exists: the retry updates it, with the
     version it came back with, instead of adding it a second time. */
  it('keeps each FAQ it has written, so a retry after a failed one does not add it twice', async () => {
    mocks.createCourseFaq
      .mockResolvedValueOnce({ data: faq('faq-1', 'In English?') })
      .mockRejectedValueOnce(refusal('The record changed in another session. Reload before saving', 'COURSE_FAQ_STALE_VERSION', 409))
      .mockResolvedValueOnce({ data: faq('faq-2', 'Placement?') });
    mocks.updateCourseFaq.mockResolvedValue({ data: faq('faq-1', 'In English?', 'faq-1-v2') });
    const user = userEvent.setup();
    render(<CourseForm id="course-1" />);
    await screen.findByRole('button', { name: 'Save draft' });
    await user.type(screen.getByRole('textbox', { name: /^Question/ }), 'In English?');
    await user.type(screen.getByRole('textbox', { name: /^Answer/ }), 'Yes.');
    await user.click(screen.getByRole('button', { name: '+ Add another FAQ' }));
    await user.type(screen.getAllByRole('textbox', { name: /^Question/ })[1], 'Placement?');
    await user.type(screen.getAllByRole('textbox', { name: /^Answer/ })[1], 'Yes.');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('The record changed in another session. Reload before saving')).toBeInTheDocument();
    expect(mocks.createCourseFaq).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.createCourseFaq).toHaveBeenCalledTimes(3));
    expect(mocks.updateCourseFaq).toHaveBeenCalledTimes(1);
    expect(mocks.updateCourseFaq.mock.calls[0].slice(0, 2)).toEqual(['course-1', 'faq-1']);
    expect(mocks.updateCourseFaq.mock.calls[0][2]).toMatchObject({ question: 'In English?', expectedUpdatedAt: 'faq-1-v1' });
    expect(mocks.createCourseFaq.mock.calls[2][1]).toMatchObject({ question: 'Placement?' });
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('keeps each section it has written, so a retry after a failed one does not add it twice', async () => {
    mocks.createCourseSection
      .mockResolvedValueOnce({ data: section('sec-1', 'Study') })
      .mockRejectedValueOnce(refusal('Choose a section the course accepts', 'COURSE_SECTION_INVALID'))
      .mockResolvedValueOnce({ data: section('sec-2', 'Careers') });
    mocks.updateCourseSection.mockResolvedValue({ data: section('sec-1', 'Study', 'sec-1-v2') });
    const user = userEvent.setup();
    render(<CourseForm id="course-1" />);
    await screen.findByRole('button', { name: 'Save draft' });
    await user.type(screen.getByRole('textbox', { name: /^Heading/ }), 'Study');
    await user.click(screen.getByRole('button', { name: '+ Add another section' }));
    await user.type(screen.getAllByRole('textbox', { name: /^Heading/ })[1], 'Careers');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('Choose a section the course accepts')).toBeInTheDocument();
    expect(mocks.createCourseSection).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.createCourseSection).toHaveBeenCalledTimes(3));
    expect(mocks.updateCourseSection).toHaveBeenCalledTimes(1);
    expect(mocks.updateCourseSection.mock.calls[0].slice(0, 2)).toEqual(['course-1', 'sec-1']);
    expect(mocks.updateCourseSection.mock.calls[0][2]).toMatchObject({ heading: 'Study', expectedUpdatedAt: 'sec-1-v1' });
    expect(mocks.createCourseSection.mock.calls[2][1]).toMatchObject({ heading: 'Careers' });
  });

  /* A removed row is deleted once: deleting it again on the retry was
     refused as not found, and the save could never get past it. */
  it('does not delete a removed FAQ again when the next one fails', async () => {
    mocks.listCourseFaqs.mockResolvedValue({ data: [faq('faq-a', 'Is it taught in English?'), faq('faq-b', 'Is there a placement?')] });
    mocks.deleteCourseFaq
      .mockResolvedValueOnce({ data: { deleted: true } })
      .mockRejectedValueOnce(refusal('The record changed in another session. Reload before saving', 'COURSE_FAQ_STALE_VERSION', 409))
      .mockResolvedValueOnce({ data: { deleted: true } });
    const user = userEvent.setup();
    render(<CourseForm id="course-1" />);
    await screen.findByDisplayValue('Is it taught in English?');
    const faqCard = (question: string) => screen.getByDisplayValue(question).closest('.p-panel') as HTMLElement;
    await user.click(within(faqCard('Is it taught in English?')).getByRole('button', { name: 'Remove' }));
    await user.click(within(faqCard('Is there a placement?')).getByRole('button', { name: 'Remove' }));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('The record changed in another session. Reload before saving')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.deleteCourseFaq).toHaveBeenCalledTimes(3));
    expect(mocks.deleteCourseFaq.mock.calls.map((call) => call[1])).toEqual(['faq-a', 'faq-b', 'faq-b']);
  });

  /* An availability row exists once created, even when its intakes are then
     refused. The retry used to create it again and was refused as "already
     mapped" to its own country. */
  it('keeps a new availability row once created, so the retry updates it', async () => {
    mocks.listEvery.mockImplementation(async (list: unknown) => (list === mocks.listCountries ? [japan] : []));
    mocks.createCourseMapping.mockResolvedValue({ data: mapping() });
    mocks.replaceCourseIntakes
      .mockRejectedValueOnce(refusal('One or more intake options are inactive', 'COURSE_INTAKE_INVALID', 409))
      .mockResolvedValue({ data: [] });
    mocks.getAdminCourse
      .mockResolvedValueOnce({ data: course() })
      .mockResolvedValue({ data: course({ countries: [mapping()] }) });
    mocks.updateCourseMapping.mockResolvedValue({ data: mapping({ updatedAt: 'map-v2' }) });
    const user = userEvent.setup();
    render(<CourseForm id="course-1" />);
    await screen.findByRole('button', { name: 'Save draft' });
    await user.selectOptions(screen.getByRole('combobox', { name: /^Country/ }), 'country-jp');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('One or more intake options are inactive')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.updateCourseMapping).toHaveBeenCalledTimes(1));
    expect(mocks.createCourseMapping).toHaveBeenCalledTimes(1);
    expect(mocks.updateCourseMapping.mock.calls[0].slice(0, 2)).toEqual(['course-1', 'map-1']);
    expect(mocks.updateCourseMapping.mock.calls[0][2]).toMatchObject({ countryId: 'country-jp', expectedUpdatedAt: 'map-v1' });
    expect(mocks.replaceCourseIntakes).toHaveBeenLastCalledWith('course-1', 'map-1', [], 'map-v2');
  });

  /* Writing a row's intakes moves the row's version on without handing it
     back; the next save sent the version from before and was refused as
     changed in another session. */
  it('sends each availability row as stored after its intakes on the next save', async () => {
    mocks.listCourseMappings.mockResolvedValue({ data: [mapping()] });
    mocks.updateCourseMapping
      .mockResolvedValueOnce({ data: mapping({ updatedAt: 'map-v2' }) })
      .mockResolvedValueOnce({ data: mapping({ updatedAt: 'map-v4' }) });
    mocks.replaceCourseIntakes.mockResolvedValue({ data: [] });
    mocks.getAdminCourse
      .mockResolvedValueOnce({ data: course({ countries: [mapping()] }) })
      .mockResolvedValue({ data: course({ countries: [mapping({ updatedAt: 'map-v3' })] }) });
    const user = userEvent.setup();
    render(<CourseForm id="course-1" />);
    await screen.findByRole('button', { name: 'Save draft' });

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.updateCourseMapping).toHaveBeenCalledTimes(1));
    expect(mocks.updateCourseMapping.mock.calls[0][2]).toMatchObject({ expectedUpdatedAt: 'map-v1' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled());

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.updateCourseMapping).toHaveBeenCalledTimes(2));
    expect(mocks.updateCourseMapping.mock.calls[1][2]).toMatchObject({ expectedUpdatedAt: 'map-v3' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  /* Only the rows this save wrote take the stored version: one it never
     reached keeps the version it was read at, so another session's change
     to it is still refused rather than overwritten. */
  it('keeps the version it read for an availability row the failed save never reached', async () => {
    mocks.listCourseMappings.mockResolvedValue({ data: [mapping()] });
    mocks.replaceCourseModes.mockRejectedValueOnce(refusal('Published courses need at least one active study mode', 'COURSE_STUDY_MODES_INVALID'));
    mocks.getAdminCourse
      .mockResolvedValueOnce({ data: course({ countries: [mapping()] }) })
      .mockResolvedValue({ data: course({ countries: [mapping({ updatedAt: 'map-v9' })] }) });
    mocks.updateCourseMapping.mockResolvedValue({ data: mapping({ updatedAt: 'map-v10' }) });
    mocks.replaceCourseIntakes.mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    render(<CourseForm id="course-1" />);
    await screen.findByRole('button', { name: 'Save draft' });
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Published courses need at least one active study mode')).toBeInTheDocument();
    expect(mocks.updateCourseMapping).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.updateCourseMapping).toHaveBeenCalledTimes(1));
    expect(mocks.updateCourseMapping.mock.calls[0][2]).toMatchObject({ expectedUpdatedAt: 'map-v1' });
  });
});
