import { beforeEach, describe, expect, it, vi } from 'vitest';

const catalog = vi.hoisted(() => ({
  getLevelPageIndex: vi.fn(),
  getSubjectLevelPage: vi.fn(),
}));
vi.mock('./catalog', () => catalog);

const { levelPageIntros } = await import('./level-page-intros');

const row = (subjectSlug: string, specializationSlug: string | null, levelCode: string, levelSlug: string, hasOwnContent = true) => ({
  path: `/subjects/${subjectSlug}`,
  subjectSlug,
  specializationSlug,
  levelCode,
  levelSlug,
  hasOwnContent,
  robotsIndex: null,
  updatedAt: '2026-10-18T00:00:00Z',
});

describe('the intros written on a field’s level pages', () => {
  beforeEach(() => {
    catalog.getLevelPageIndex.mockReset();
    catalog.getSubjectLevelPage.mockReset();
  });

  it('reads only the field’s own published pages, by level code, search-ready or not', async () => {
    catalog.getLevelPageIndex.mockResolvedValue({
      rows: [
        row('cs', null, 'PG', 'masters'),
        /* Published with an intro but fewer than three FAQs: still read. */
        row('cs', null, 'UG', 'bachelors', false),
        row('cs', 'ai', 'PG', 'masters'),
        row('law', null, 'PG', 'masters'),
      ],
      templateRobotsIndex: null,
    });
    catalog.getSubjectLevelPage.mockImplementation(async ({ level }: { level: string }) => ({
      content: { intro: `<p>${level}</p>` },
    }));
    expect(await levelPageIntros({ subject: 'cs' })).toEqual({ PG: '<p>masters</p>', UG: '<p>bachelors</p>' });
    expect(catalog.getSubjectLevelPage).toHaveBeenCalledTimes(2);
    expect(catalog.getSubjectLevelPage).toHaveBeenCalledWith({ subject: 'cs', level: 'masters' });
  });

  it('matches the field however its address was cased', async () => {
    catalog.getLevelPageIndex.mockResolvedValue({ rows: [row('cs', null, 'PG', 'masters')], templateRobotsIndex: null });
    catalog.getSubjectLevelPage.mockResolvedValue({ content: { intro: '<p>A Master’s in CS.</p>' } });
    expect(await levelPageIntros({ subject: 'CS' })).toEqual({ PG: '<p>A Master’s in CS.</p>' });
  });

  it('reads a specialization’s pages under the specialization', async () => {
    catalog.getLevelPageIndex.mockResolvedValue({ rows: [row('cs', 'ai', 'PHD', 'phd'), row('cs', null, 'PHD', 'phd')], templateRobotsIndex: null });
    catalog.getSubjectLevelPage.mockResolvedValue({ content: { intro: '<p>AI PhD.</p>' } });
    expect(await levelPageIntros({ subject: 'cs', specialization: 'ai' })).toEqual({ PHD: '<p>AI PhD.</p>' });
    expect(catalog.getSubjectLevelPage).toHaveBeenCalledWith({ subject: 'cs', specialization: 'ai', level: 'phd' });
  });

  it('leaves out a page with no intro or one that fails, and gives nothing when the list fails', async () => {
    catalog.getLevelPageIndex.mockResolvedValue({ rows: [row('cs', null, 'PG', 'masters'), row('cs', null, 'PHD', 'phd')], templateRobotsIndex: null });
    catalog.getSubjectLevelPage
      .mockResolvedValueOnce({ content: { intro: '  ' } })
      .mockRejectedValueOnce(new Error('down'));
    expect(await levelPageIntros({ subject: 'cs' })).toEqual({});
    catalog.getLevelPageIndex.mockRejectedValue(new Error('down'));
    expect(await levelPageIntros({ subject: 'cs' })).toEqual({});
  });
});
