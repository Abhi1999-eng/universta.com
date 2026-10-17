import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpecializationForm } from './SpecializationForm';

/**
 * A specialization's editor carries the same Level pages card as a subject's,
 * directly under its study-level ticks. Its own sections and FAQs stay where
 * they were: the card only adds the pages it has at each level.
 */

const push = vi.fn();
const replace = vi.fn();
const mocks = vi.hoisted(() => ({
  createSpecializationFaq: vi.fn(),
  createSpecializationSection: vi.fn(),
  createSubSubject: vi.fn(),
  deleteSpecializationFaq: vi.fn(),
  deleteSpecializationSection: vi.fn(),
  deleteSpecializationSeo: vi.fn(),
  getSpecialization: vi.fn(),
  getSpecializationCountries: vi.fn(),
  getSubjectCountries: vi.fn(),
  getSpecializationSeo: vi.fn(),
  listAllSubjects: vi.fn(),
  listCountries: vi.fn(),
  listCourseLevels: vi.fn(),
  listEditorialMedia: vi.fn(),
  listEvery: vi.fn(),
  saveSpecializationCountries: vi.fn(),
  listSpecializationFaqs: vi.fn(),
  listSpecializationSections: vi.fn(),
  publishSubSubject: vi.fn(),
  saveSpecializationSeo: vi.fn(),
  unpublishSubSubject: vi.fn(),
  updateSpecializationFaq: vi.fn(),
  updateSpecializationSection: vi.fn(),
  updateSubSubject: vi.fn(),
  listLevelPages: vi.fn(),
  deleteLevelPage: vi.fn(),
}));
vi.mock('./catalog-client', () => mocks);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/' }));
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a {...rest} href={href}>{children}</a>
  ),
}));

const phd = { id: 'lvl-phd', code: 'PHD', name: 'PhD', description: null, educationOrder: 6, displayOrder: 0, status: 'ACTIVE', createdAt: 'c', updatedAt: 'u' };
const specialization = (status = 'DRAFT', subjectStatus = 'PUBLISHED') => ({
  id: 'spec-1',
  subject: { id: 'subject-1', name: 'Marine Sciences', slug: 'marine-sciences', status: subjectStatus },
  name: 'Marine Biology',
  slug: 'marine-biology',
  shortDescription: 'Life in the ocean.',
  overview: null,
  iconMedia: null,
  listingMedia: null,
  featured: false,
  displayOrder: 0,
  courseLevels: [{ id: 'lvl-phd', name: 'PhD', code: 'PHD' }],
  impliedCourseLevels: [],
  status,
  publishedAt: null,
  createdAt: 'c',
  updatedAt: 'spec-v1',
});
const phdRow = {
  level: { id: 'lvl-phd', code: 'PHD', name: 'PhD', slug: 'phd', description: null, status: 'ACTIVE' },
  offered: true,
  sources: ['TICKED'],
  path: '/subjects/marine-sciences/marine-biology/phd',
  page: null,
};

beforeEach(() => {
  mocks.listEditorialMedia.mockResolvedValue({ data: [], meta: null });
  mocks.listAllSubjects.mockResolvedValue([{ id: 'subject-1', name: 'Marine Sciences', slug: 'marine-sciences', status: 'PUBLISHED' }]);
  mocks.listCourseLevels.mockResolvedValue({ data: [phd], meta: null });
  mocks.listEvery.mockResolvedValue([]);
  mocks.getSpecialization.mockResolvedValue({ data: specialization() });
  mocks.getSpecializationSeo.mockResolvedValue({ data: null });
  mocks.listSpecializationSections.mockResolvedValue({ data: [] });
  mocks.listSpecializationFaqs.mockResolvedValue({ data: [] });
  mocks.getSpecializationCountries.mockResolvedValue({ data: [] });
  mocks.getSubjectCountries.mockResolvedValue({ data: [] });
  mocks.saveSpecializationCountries.mockResolvedValue({ data: [] });
  mocks.updateSubSubject.mockResolvedValue({ data: { ...specialization(), updatedAt: 'spec-v2' } });
  mocks.listLevelPages.mockResolvedValue({ data: [phdRow], meta: null });
});

describe('specialization editor and its level pages', () => {
  it('lists the pages of a saved specialization under its study levels', async () => {
    const { container } = render(<SpecializationForm id="spec-1" />);
    const link = await screen.findByRole('link', { name: 'Write the PhD page' });
    expect(link).toHaveAttribute('href', '/specializations/spec-1/level-pages/lvl-phd');
    expect(mocks.listLevelPages).toHaveBeenCalledWith('specialization', 'spec-1');

    /* Directly after the ticks, before the destinations. */
    const order = [...container.querySelectorAll('form > fieldset[id]')].map((element) => element.id);
    expect(order.slice(order.indexOf('specialization-levels'), order.indexOf('specialization-levels') + 3)).toEqual([
      'specialization-levels',
      'specialization-level-pages',
      'specialization-destinations',
    ]);
  });

  it('asks a new specialization to be saved first, and reads nothing', async () => {
    render(<SpecializationForm />);
    expect(await screen.findByText(/Save the specialization first/)).toBeInTheDocument();
    expect(mocks.listLevelPages).not.toHaveBeenCalled();
  });

  it('reads the rows again after a draft save', async () => {
    const user = userEvent.setup();
    render(<SpecializationForm id="spec-1" />);
    await screen.findByRole('link', { name: 'Write the PhD page' });
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.updateSubSubject).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.listLevelPages).toHaveBeenCalledTimes(2));
  });

  it('keeps its own sections and FAQs as they were', async () => {
    render(<SpecializationForm id="spec-1" />);
    await screen.findByRole('link', { name: 'Write the PhD page' });
    expect(screen.getByRole('heading', { name: 'Content sections' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'FAQs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Level pages' })).toBeInTheDocument();
  });

  it('offers no live link while its subject is a draft', async () => {
    mocks.getSpecialization.mockResolvedValue({ data: specialization('PUBLISHED', 'DRAFT') });
    render(<SpecializationForm id="spec-1" />);
    await screen.findByRole('link', { name: 'Write the PhD page' });
    expect(screen.queryByRole('link', { name: /View on site/ })).toBeNull();
  });

  it('links to the live page once both are published', async () => {
    mocks.getSpecialization.mockResolvedValue({ data: specialization('PUBLISHED', 'PUBLISHED') });
    render(<SpecializationForm id="spec-1" />);
    await screen.findByRole('link', { name: 'Write the PhD page' });
    expect(screen.getByRole('link', { name: /View on site/ }).getAttribute('href')).toMatch(/\/subjects\/marine-sciences\/marine-biology\/phd$/);
  });

  it('names the specialization in the SEO alert', async () => {
    const user = userEvent.setup();
    render(<SpecializationForm id="spec-1" />);
    await screen.findByRole('link', { name: 'Write the PhD page' });
    await user.type(screen.getByRole('textbox', { name: 'Focus keyword' }), 'marine');
    expect(screen.getByText('SEO title and Meta description are required before this specialization can be saved.')).toBeInTheDocument();
  });
});
