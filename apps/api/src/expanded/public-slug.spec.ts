import {
  countCanonicalPublicSlugs,
  isCanonicalPublicSlug,
} from '../common/public-slug';

describe('public slug guard', () => {
  it.each(['canada', 'northstar-university', 'course-2026'])(
    'accepts canonical slug %s',
    (slug) => expect(isCanonicalPublicSlug(slug)).toBe(true),
  );

  it.each(['/lk', 'two/slugs', 'Uppercase', 'space here', '', '-edge'])(
    'rejects non-canonical slug %s',
    (slug) => expect(isCanonicalPublicSlug(slug)).toBe(false),
  );

  it('counts only canonical public rows', () => {
    expect(
      countCanonicalPublicSlugs([
        { slug: 'canada' },
        { slug: '/lk' },
        { slug: 'northstar-university' },
      ]),
    ).toBe(2);
  });
});
