import { SettingsService } from './settings.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { StructuredLogger } from '../common/structured-logger.service';

/** Reproduces the production incident: the header menu the site was
 * configured to use sat INACTIVE for hours with nothing in the logs, because
 * the query that resolves it filtered by status and simply found nothing.
 * These pin that the failure is now observable, not just silent. */

type Row = Record<string, unknown>;

function fakePrisma(menus: Row[]) {
  return {
    siteSetting: {
      findMany: async () => [] as Row[],
    },
    navigationMenu: {
      findMany: async ({ where }: { where: { menuKey: { in: string[] } } }) =>
        menus.filter((menu) =>
          where.menuKey.in.includes(menu.menuKey as string),
        ),
    },
  } as unknown as PrismaService;
}

function fakeLogger() {
  const errors: Array<{ message: string; details: Record<string, unknown> }> =
    [];
  return {
    errors,
    logError: (message: string, details: Record<string, unknown> = {}) => {
      errors.push({ message, details });
    },
    logRequest: () => {},
  } as unknown as StructuredLogger & { errors: typeof errors };
}

describe('SettingsService.publicChrome menu resolution', () => {
  it('logs and renders empty when the resolved header menu is inactive', async () => {
    const logger = fakeLogger();
    const service = new SettingsService(
      fakePrisma([
        { id: 'm1', menuKey: 'header', status: 'INACTIVE', items: [] },
        { id: 'm2', menuKey: 'footer', status: 'ACTIVE', items: [] },
      ]),
      logger,
    );

    const chrome = await service.publicChrome();

    expect(chrome.headerMenu).toEqual([]);
    expect(logger.errors).toContainEqual({
      message: 'site chrome menu resolved to an inactive menu',
      details: { menuKey: 'header', menuId: 'm1', status: 'INACTIVE' },
    });
  });

  it('logs nothing when both menus resolve to an active menu', async () => {
    const logger = fakeLogger();
    const service = new SettingsService(
      fakePrisma([
        { id: 'm1', menuKey: 'header', status: 'ACTIVE', items: [] },
        { id: 'm2', menuKey: 'footer', status: 'ACTIVE', items: [] },
      ]),
      logger,
    );

    await service.publicChrome();

    expect(logger.errors).toEqual([]);
  });

  it('logs nothing extra for a menu that was never created at all', async () => {
    // A missing menu is the foundation seed's job to repair; it is a
    // different failure mode from one that exists but was deactivated, and
    // must not be confused with it in the logs.
    const logger = fakeLogger();
    const service = new SettingsService(fakePrisma([]), logger);

    const chrome = await service.publicChrome();

    expect(chrome.headerMenu).toEqual([]);
    expect(logger.errors).toEqual([]);
  });
});
