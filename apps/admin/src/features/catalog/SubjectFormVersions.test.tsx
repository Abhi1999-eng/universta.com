import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubjectForm } from './SubjectForm';

/**
 * Saving a subject writes its specializations and then publishes them, and
 * publishing bumps a record's version. The form kept the rows from before that
 * second step, so the next save sent a version the server had already moved
 * past and was refused with "changed in another session" -- for an edit nobody
 * else had made. An author had to reload between every two saves.
 */

const push = vi.fn();
const replace = vi.fn();

const mocks = vi.hoisted(() => ({
  getSubject: vi.fn(),
  getSubjectSeo: vi.fn(),
  listSubSubjects: vi.fn(),
  createSubject: vi.fn(),
  updateSubject: vi.fn(),
  publishSubject: vi.fn(),
  unpublishSubject: vi.fn(),
  createSubSubject: vi.fn(),
  updateSubSubject: vi.fn(),
  deleteSubSubject: vi.fn(),
  publishSubSubject: vi.fn(),
  unpublishSubSubject: vi.fn(),
  saveSubjectSeo: vi.fn(),
  deleteSubjectSeo: vi.fn(),
  listEditorialMedia: vi.fn(),
}));
vi.mock('./catalog-client', () => mocks);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, refresh: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const subject = {
  id: 'subject-1',
  name: 'Marine Sciences',
  slug: 'marine-sciences',
  shortDescription: 'Oceans.',
  overview: null,
  iconMedia: null,
  listingMedia: null,
  heroMedia: null,
  featured: false,
  displayOrder: 0,
  status: 'DRAFT',
  updatedAt: 'subject-v1',
};

const child = (updatedAt: string, status: string) => ({
  id: 'spec-1',
  name: 'Marine Biology',
  slug: 'marine-biology',
  shortDescription: 'Life in the ocean.',
  overview: null,
  iconMedia: null,
  listingMedia: null,
  featured: false,
  displayOrder: 0,
  status,
  updatedAt,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSubject.mockResolvedValue({ data: subject });
  mocks.getSubjectSeo.mockResolvedValue({ data: null });
  mocks.listSubSubjects.mockResolvedValue({ data: [child('spec-v1', 'DRAFT')], meta: null });
  mocks.listEditorialMedia.mockResolvedValue({ data: [], meta: null });
  mocks.updateSubject.mockResolvedValue({ data: { ...subject, updatedAt: 'subject-v2' } });
  mocks.publishSubject.mockResolvedValue({
    data: { ...subject, status: 'PUBLISHED', updatedAt: 'subject-v3' },
  });
  // The save writes the child, then publishing it moves the version on again.
  mocks.updateSubSubject.mockResolvedValue({ data: child('spec-v2', 'DRAFT') });
  mocks.publishSubSubject.mockResolvedValue({ data: child('spec-v3', 'PUBLISHED') });
});

describe('subject form record versions', () => {
  it('keeps the version publishing returned, so a second save is not refused', async () => {
    const user = userEvent.setup();
    const { container } = render(<SubjectForm id="subject-1" />);

    // The subject and each specialization both have a "Short description",
    // so this picks the subject's by the id the form gives it.
    await screen.findByRole('button', { name: 'Publish' });
    const overview = container.querySelector<HTMLTextAreaElement>('#subject-short')!;
    await user.clear(overview);
    await user.type(overview, 'First edit.');
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(mocks.publishSubSubject).toHaveBeenCalledTimes(1));
    expect(mocks.updateSubSubject).toHaveBeenNthCalledWith(
      1,
      'subject-1',
      'spec-1',
      expect.objectContaining({ expectedUpdatedAt: 'spec-v1' }),
    );

    await user.clear(overview);
    await user.type(overview, 'Second edit, with no reload in between.');
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(mocks.updateSubSubject).toHaveBeenCalledTimes(2));
    // The version publishing handed back, not the one from before it.
    expect(mocks.updateSubSubject).toHaveBeenNthCalledWith(
      2,
      'subject-1',
      'spec-1',
      expect.objectContaining({ expectedUpdatedAt: 'spec-v3' }),
    );
  });
});
