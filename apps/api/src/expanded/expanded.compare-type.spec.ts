import { BadRequestException } from '@nestjs/common';
import { ExpandedPublicController } from './expanded.controller';
import { ExpandedService } from './expanded.service';
import type { RequestWithId } from '../common/http.types';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';

/** ISS-034. An unknown comparison `:type` on `GET /phase1/compare/:type`
 * threw a plain `Error`, which Nest's default filter turns into an
 * unhandled 500 -- a client typo in the URL should never look like a
 * server crash. The sibling `/compare/:type/options` route already got
 * this right (`BadRequestException`, a clean 400); this just matches it. */
describe('ExpandedPublicController.compare -- unknown type', () => {
  function fakeRequest(): RequestWithId {
    return { requestId: 'req-1' } as unknown as RequestWithId;
  }

  it('throws BadRequestException, not a plain Error, for an unrecognized type', async () => {
    const controller = new ExpandedPublicController({} as ExpandedService);
    await expect(
      controller.compare(fakeRequest(), 'bogus-type' as 'countries', ''),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('still calls through to the service for a recognized type', async () => {
    const compare = jest.fn().mockResolvedValue({ items: [], invalid: [] });
    const controller = new ExpandedPublicController({
      compare,
    } as unknown as ExpandedService);
    await controller.compare(fakeRequest(), 'countries', 'canada,australia');
    expect(compare).toHaveBeenCalledWith('countries', ['canada', 'australia']);
  });
});

/**
 * Comparing programmes. Both references compare up to four courses side by
 * side; universities allow five, while countries and consultants hold three.
 * A programme compares only
 * while its university and that university's destination are live -- the
 * rule every programme list keeps -- so a column never links to a page that
 * answers 404, and each comes with its university's country, which the
 * programme's address is built from.
 */
describe('ExpandedService.compare -- courses', () => {
  type Args = Record<string, any>;
  const live = (slug: string) => ({
    slug,
    university: {
      name: 'University of Warwick',
      slug: 'university-of-warwick',
      country: {
        name: 'United Kingdom',
        slug: 'united-kingdom',
        iso2Code: 'GB',
      },
    },
  });

  function build(rows: Array<Record<string, unknown>>) {
    const calls: Args[] = [];
    const findMany = async (args: Args) => {
      calls.push(args);
      const wanted = args.where.slug.in as string[];
      return rows.filter((row) => wanted.includes(row.slug as string));
    };
    const prisma = {
      universityCourseOffering: { findMany },
      country: { findMany },
      university: { findMany },
      consultant: { findMany },
    } as unknown as PrismaService;
    return {
      service: new ExpandedService(prisma, {} as ExperimentsService),
      calls,
    };
  }

  it('keeps five universities, four programmes, and three countries or consultants', async () => {
    const { service, calls } = build([]);
    const six = ['a', 'b', 'c', 'd', 'e', 'f'];
    await service.compare('courses', six);
    await service.compare('universities', six);
    await service.compare('countries', six);
    await service.compare('consultants', six);
    expect(calls.map((args) => args.where.slug.in)).toEqual([
      ['a', 'b', 'c', 'd'],
      ['a', 'b', 'c', 'd', 'e'],
      ['a', 'b', 'c'],
      ['a', 'b', 'c'],
    ]);
  });

  it('returns all five universities in requested order and ignores the sixth', async () => {
    const { service, calls } = build([
      { slug: 'f' },
      { slug: 'e' },
      { slug: 'c' },
      { slug: 'a' },
      { slug: 'd' },
      { slug: 'b' },
    ]);
    const result = await service.compare('universities', [
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
    ]);
    expect(result.items.map((row) => row.slug)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
    expect(result.invalid).toEqual([]);
    expect(calls[0].where).toMatchObject({
      slug: { in: ['a', 'b', 'c', 'd', 'e'] },
      status: 'PUBLISHED',
      deletedAt: null,
    });
  });

  it('normalizes and deduplicates university slugs before applying the five-column cap', async () => {
    const { service, calls } = build([
      { slug: 'a' },
      { slug: 'b' },
      { slug: 'c' },
      { slug: 'e' },
    ]);
    const result = await service.compare('universities', [
      ' A ',
      '',
      'a',
      'B',
      'c',
      'd',
      'e',
      'f',
    ]);
    expect(calls[0].where.slug.in).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(result.items.map((row) => row.slug)).toEqual(['a', 'b', 'c', 'e']);
    expect(result.invalid).toEqual(['d']);
  });

  it('asks for live universities in published destinations, and reports the rest invalid', async () => {
    /* The database answers only the live ones: the programme at an
       unpublished university, or in an unpublished country, does not come
       back. */
    const { service, calls } = build([live('a'), live('c')]);
    const result = await service.compare('courses', ['a', 'b', 'c']);
    expect(calls[0].where.university).toMatchObject({
      status: 'PUBLISHED',
      deletedAt: null,
      country: { status: 'PUBLISHED', deletedAt: null },
    });
    expect(calls[0].where.university.AND).toHaveLength(2);
    expect(result.items.map((row) => row.slug)).toEqual(['a', 'c']);
    expect(result.invalid).toEqual(['b']);
  });

  it('brings each programme’s university country, subject and current intakes', async () => {
    const { service, calls } = build([live('a')]);
    const result = await service.compare('courses', ['a']);
    const include = calls[0].include;
    expect(include.university.select.country.select).toMatchObject({
      slug: true,
    });
    expect(include.genericCourse.include).toMatchObject({
      courseLevel: true,
      subject: expect.anything(),
      subSubject: expect.anything(),
    });
    expect(include.intakes.where).toEqual({ status: 'ACTIVE' });
    expect(include.requirements.where).toEqual({
      status: 'ACTIVE',
      deletedAt: null,
    });
    expect(
      (
        result.items[0] as unknown as {
          university: { country: { slug: string } };
        }
      ).university.country.slug,
    ).toBe('united-kingdom');
  });

  it('offers only live programmes to pick from, each with its university', async () => {
    const calls: Args[] = [];
    const prisma = {
      universityCourseOffering: {
        findMany: async (args: Args) => {
          calls.push(args);
          return [
            {
              slug: 'a',
              name: 'MSc Computer Science',
              university: { name: 'University of Warwick', slug: 'warwick' },
            },
          ];
        },
      },
    } as unknown as PrismaService;
    const service = new ExpandedService(prisma, {} as ExperimentsService);
    const options = await service.comparisonOptions('courses');
    expect(calls[0].where.university.country).toEqual({
      status: 'PUBLISHED',
      deletedAt: null,
    });
    expect(options).toEqual([
      {
        slug: 'a',
        name: 'MSc Computer Science',
        university: { name: 'University of Warwick', slug: 'warwick' },
      },
    ]);
  });
});
