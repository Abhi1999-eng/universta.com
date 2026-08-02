import { StaticPageSeoService } from './static-page-seo.service';
import type { PrismaService } from '../prisma/prisma.service';

/** ISS-030. adminList() previously returned only { key, label, seo }, with no
 * way for the admin UI to know a never-saved page's intended default robots
 * behaviour -- so the editor's checkbox defaulted to checked for every page,
 * including compare-countries, whose defaultRobotsIndex is false until an
 * admin explicitly opts in. */
describe('StaticPageSeoService.adminList', () => {
  function service() {
    const prisma = {
      seoMetadata: { findMany: async () => [] },
    } as unknown as PrismaService;
    return new StaticPageSeoService(prisma);
  }

  it("includes each page's own defaultRobotsIndex alongside its saved record", async () => {
    const rows = await service().adminList();
    const compareCountries = rows.find(
      (row) => row.key === 'compare-countries',
    );
    const faq = rows.find((row) => row.key === 'faq');

    expect(compareCountries?.defaultRobotsIndex).toBe(false);
    expect(faq?.defaultRobotsIndex).toBe(true);
  });
});
