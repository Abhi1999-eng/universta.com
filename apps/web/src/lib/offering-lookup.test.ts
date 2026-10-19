import { describe, expect, it, vi } from 'vitest';
import { findOffering, programmeSlugs, shortOfferingSlugs, type OfferingLookup } from './offering-lookup';

/**
 * The short programme address: /study-abroad/japan/universities/
 * university-of-tokyo/courses/master-of-information-science-and-technology
 * answered 404 because only "<university>-<course>" was tried, while the
 * admin writes "<course>-at-the-<university>".
 */

const uni = 'university-of-tokyo';
const mist = 'master-of-information-science-and-technology';
const live = `${mist}-at-the-${uni}`;

function lookup(slugs: string[], ofCourse: string[] = []): OfferingLookup & { load: ReturnType<typeof vi.fn> } {
  return {
    load: vi.fn(async (_university: string, slug: string) =>
      slugs.includes(slug) ? { slug } : null,
    ),
    ofCourse: async () => ofCourse,
  };
}

describe('a programme by a short address', () => {
  it('answers the exact slug first, and asks nothing else', async () => {
    const found = lookup([live]);
    expect(await findOffering(uni, live, found)).toEqual({ slug: live });
    expect(found.load).toHaveBeenCalledTimes(1);
  });

  it('tries the admin’s "<course>-at-the-<university>" spelling', async () => {
    expect(await findOffering(uni, mist, lookup([live]))).toEqual({ slug: live });
  });

  it('still tries the older "<university>-<course>" spelling', async () => {
    expect(await findOffering(uni, 'msc-ai', lookup([`${uni}-msc-ai`]))).toEqual({
      slug: `${uni}-msc-ai`,
    });
  });

  it('falls back to the university’s one live programme of that course', async () => {
    const own = 'mist-tokyo-2027';
    expect(await findOffering(uni, mist, lookup([own], [own]))).toEqual({ slug: own });
  });

  it('does not guess between two programmes of the course', async () => {
    expect(await findOffering(uni, mist, lookup(['a', 'b'], ['a', 'b']))).toBeNull();
  });

  it('answers nothing when nothing matches, and survives a failed lookup', async () => {
    expect(await findOffering(uni, 'nope', lookup([]))).toBeNull();
    expect(
      await findOffering(uni, 'nope', {
        load: async () => null,
        ofCourse: () => Promise.reject(new Error('down')),
      }),
    ).toBeNull();
  });

  it('does not try a spelling the slug already has', () => {
    expect(shortOfferingSlugs(uni, live)).toEqual([`${uni}-${live}`]);
    expect(shortOfferingSlugs(uni, `${uni}-msc`)).toEqual([`${uni}-msc-at-the-${uni}`]);
  });

  it('reads the programmes API’s answer as slugs, counting what it did not list', () => {
    expect(programmeSlugs({ data: [{ slug: 'a' }], meta: { total: 1 } })).toEqual(['a']);
    expect(programmeSlugs({ data: [{ slug: 'a' }], meta: { total: 3 } })).toHaveLength(2);
    expect(programmeSlugs(null)).toEqual([]);
  });
});
