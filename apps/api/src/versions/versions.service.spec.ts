import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VersionsService } from './versions.service';

/** The invariants that matter here are destructive if broken: a restore must
 * never publish, never delete later history, and never write an unreadable
 * snapshot back over live content. */

function makePrisma(overrides: Record<string, unknown> = {}) {
  const versions: Array<Record<string, unknown>> = [];
  const prisma = {
    _versions: versions,
    contentVersion: {
      findFirst: jest.fn(({ where, orderBy }: never) => {
        const w = where as Record<string, unknown>;
        let matches = versions.filter(
          (v) =>
            v.resourceType === w.resourceType && v.resourceId === w.resourceId,
        );
        if (typeof w.versionNumber === 'number')
          matches = matches.filter((v) => v.versionNumber === w.versionNumber);
        if (orderBy)
          matches = [...matches].sort(
            (a, b) => Number(b.versionNumber) - Number(a.versionNumber),
          );
        return Promise.resolve(matches[0] ?? null);
      }),
      findMany: jest.fn(() =>
        Promise.resolve(
          [...versions].sort(
            (a, b) => Number(b.versionNumber) - Number(a.versionNumber),
          ),
        ),
      ),
      count: jest.fn(() => Promise.resolve(versions.length)),
      create: jest.fn(({ data }: never) => {
        versions.push(data);
        return Promise.resolve(data);
      }),
    },
    page: {
      findFirst: jest.fn(() =>
        Promise.resolve({
          id: 'page-1',
          pageType: 'STATIC',
          title: 'Current title',
          slug: 'about',
          status: 'PUBLISHED',
          sections: [],
        }),
      ),
      update: jest.fn(() => Promise.resolve({})),
    },
    pageSection: { findFirst: jest.fn(), update: jest.fn() },
    pageTemplate: { findFirst: jest.fn(), update: jest.fn() },
    siteSetting: {
      findMany: jest.fn(() => Promise.resolve([])),
      updateMany: jest.fn(),
    },
    auditLog: { create: jest.fn(() => Promise.resolve({})) },
    ...overrides,
  };
  return prisma;
}

describe('VersionsService', () => {
  it('numbers versions monotonically per resource', async () => {
    const prisma = makePrisma();
    const service = new VersionsService(prisma as never);
    await service.record({
      resourceType: 'PAGE',
      resourceId: 'page-1',
      changeSummary: 'first',
      sourceAction: 'update',
    });
    await service.record({
      resourceType: 'PAGE',
      resourceId: 'page-1',
      changeSummary: 'second',
      sourceAction: 'update',
    });
    expect(prisma._versions.map((v) => v.versionNumber)).toEqual([1, 2]);
  });

  it('captures a baseline only once, before the first tracked edit', async () => {
    const prisma = makePrisma();
    const service = new VersionsService(prisma as never);
    const first = await service.ensureBaseline('PAGE', 'page-1');
    const second = await service.ensureBaseline('PAGE', 'page-1');
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(prisma._versions).toHaveLength(1);
    expect(prisma._versions[0].sourceAction).toBe('baseline');
  });

  it('skips versioning a resource that no longer exists', async () => {
    const prisma = makePrisma({
      page: { findFirst: jest.fn(() => Promise.resolve(null)) },
    });
    const service = new VersionsService(prisma as never);
    const result = await service.record({
      resourceType: 'PAGE',
      resourceId: 'gone',
      changeSummary: 'x',
      sourceAction: 'update',
    });
    expect(result).toBeNull();
    expect(prisma._versions).toHaveLength(0);
  });

  it('compares field-by-field and reports only real differences', async () => {
    const prisma = makePrisma();
    prisma._versions.push(
      {
        resourceType: 'PAGE',
        resourceId: 'page-1',
        versionNumber: 1,
        createdAt: new Date(),
        snapshotJson: { title: 'Old', slug: 'about', sections: [] },
      },
      {
        resourceType: 'PAGE',
        resourceId: 'page-1',
        versionNumber: 2,
        createdAt: new Date(),
        snapshotJson: { title: 'New', slug: 'about', sections: [] },
      },
    );
    const service = new VersionsService(prisma as never);
    const result = await service.compare('PAGE', 'page-1', 1, 2);
    expect(result.identical).toBe(false);
    expect(result.changes).toEqual([
      { field: 'title', from: 'Old', to: 'New' },
    ]);
  });

  it('restore appends a new version and leaves later ones in place', async () => {
    const prisma = makePrisma();
    prisma._versions.push(
      {
        resourceType: 'PAGE',
        resourceId: 'page-1',
        versionNumber: 1,
        createdAt: new Date(),
        snapshotJson: {
          title: 'Old',
          slug: 'about',
          pageType: 'STATIC',
          sections: [],
        },
      },
      {
        resourceType: 'PAGE',
        resourceId: 'page-1',
        versionNumber: 2,
        createdAt: new Date(),
        snapshotJson: {
          title: 'New',
          slug: 'about',
          pageType: 'STATIC',
          sections: [],
        },
      },
    );
    const service = new VersionsService(prisma as never);
    const result = await service.restore('PAGE', 'page-1', 1, 'admin-1');

    expect(result).toEqual({ restoredFromVersion: 1, newVersion: 3 });
    expect(prisma._versions.map((v) => v.versionNumber)).toEqual([1, 2, 3]);
    expect(prisma._versions[2]).toMatchObject({
      sourceAction: 'restore',
      restoredFromVersion: 1,
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('never writes publication state back during a restore', async () => {
    const prisma = makePrisma();
    prisma._versions.push({
      resourceType: 'PAGE',
      resourceId: 'page-1',
      versionNumber: 1,
      createdAt: new Date(),
      // A snapshot taken while the page was still a draft.
      snapshotJson: {
        title: 'Old',
        slug: 'about',
        pageType: 'STATIC',
        status: 'DRAFT',
        sections: [],
      },
    });
    const service = new VersionsService(prisma as never);
    await service.restore('PAGE', 'page-1', 1, 'admin-1');
    const written = prisma.page.update.mock.calls[0][0].data;
    expect(written).not.toHaveProperty('status');
    expect(written.title).toBe('Old');
  });

  it('refuses to restore an unreadable or incomplete snapshot', async () => {
    const prisma = makePrisma();
    prisma._versions.push(
      {
        resourceType: 'PAGE',
        resourceId: 'page-1',
        versionNumber: 1,
        createdAt: new Date(),
        snapshotJson: 'not an object',
      },
      {
        resourceType: 'PAGE',
        resourceId: 'page-1',
        versionNumber: 2,
        createdAt: new Date(),
        snapshotJson: { title: 'Only a title' },
      },
    );
    const service = new VersionsService(prisma as never);
    await expect(service.restore('PAGE', 'page-1', 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.restore('PAGE', 'page-1', 2)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.page.update).not.toHaveBeenCalled();
  });

  it('rejects a version number that does not exist', async () => {
    const prisma = makePrisma();
    const service = new VersionsService(prisma as never);
    await expect(service.restore('PAGE', 'page-1', 99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
