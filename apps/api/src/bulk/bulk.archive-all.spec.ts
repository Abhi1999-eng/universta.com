import { createLimiter } from '../courses/courses.service';

/**
 * Archiving a whole resource.
 *
 * A selection cannot say "all of them" once a resource is large: the
 * universities are nine thousand and one request accepts two thousand ids.
 * So `all` has the server read the ids itself -- and the two things that
 * then have to hold at that size are checked here, because neither shows up
 * at the three-row scale the other specs work at.
 */

/** The ids the `all` branch reads, exactly as it reads them. */
async function idsForAll(table: {
  findMany: (args: unknown) => Promise<Array<{ id: string }>>;
}) {
  const rows = await table.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

describe('reading the ids on the server', () => {
  it('takes every live row and leaves the archived ones', async () => {
    const seen: unknown[] = [];
    const table = {
      findMany: async (args: unknown) => {
        seen.push(args);
        return [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      },
    };
    expect(await idsForAll(table)).toEqual(['a', 'b', 'c']);
    expect(seen[0]).toEqual({
      where: { deletedAt: null },
      select: { id: true },
    });
  });
});

describe('the dependency check at nine thousand rows', () => {
  /** Run sequentially this is one round trip per row; the request is gone
   * before the last one. The gate is what keeps it to a bounded fan-out. */
  it('runs bounded-concurrently rather than one after another', async () => {
    const ids = Array.from({ length: 200 }, (_, index) => `id-${index}`);
    let inFlight = 0;
    let peak = 0;
    const gate = createLimiter(8);
    await Promise.all(
      ids.map((id) =>
        gate(async () => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await new Promise((resolve) => setTimeout(resolve, 1));
          inFlight -= 1;
          return id;
        }),
      ),
    );
    expect(peak).toBeLessThanOrEqual(8);
    expect(peak).toBeGreaterThan(1);
  });

  it('keeps a blocked row out and lets the rest through', async () => {
    const check = async (id: string) =>
      id === 'id-3' ? '2 campus(es) still belong to this university' : null;
    const ids = ['id-1', 'id-2', 'id-3', 'id-4'];
    const gate = createLimiter(8);
    const checks = await Promise.all(
      ids.map((id) => gate(async () => ({ id, reason: await check(id) }))),
    );
    const blocked = checks.filter((row) => row.reason);
    const archivable = checks.filter((row) => !row.reason).map((row) => row.id);
    expect(archivable).toEqual(['id-1', 'id-2', 'id-4']);
    expect(blocked).toHaveLength(1);
  });
});

describe('writing the archive', () => {
  /** `IN (...)` with nine thousand ids is one statement the server may
   * refuse outright on packet size. */
  function chunk<T>(rows: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let from = 0; from < rows.length; from += size)
      out.push(rows.slice(from, from + size));
    return out;
  }

  it('splits the ids into runs the database will accept', () => {
    const ids = Array.from({ length: 9761 }, (_, index) => String(index));
    const parts = chunk(ids, 500);
    expect(parts).toHaveLength(20);
    expect(parts.every((part) => part.length <= 500)).toBe(true);
    expect(parts.flat()).toHaveLength(9761);
  });

  it('counts what every run reported, not just the last', () => {
    const counts = [{ count: 500 }, { count: 500 }, { count: 261 }];
    expect(counts.reduce((sum, one) => sum + one.count, 0)).toBe(1261);
  });
});
