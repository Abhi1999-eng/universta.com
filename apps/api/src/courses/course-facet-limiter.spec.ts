import { createLimiter } from './courses.service';

/**
 * The course filter rail asks for one `SELECT COUNT(*)` per option, across
 * seven facets, and every one of them was fired at once. With 1,077
 * specializations and 206 destinations on the demo that is about 1,340
 * concurrent queries against a pool of a few dozen connections, and the
 * whole page came back "Database is temporarily unavailable" rather than
 * slowly. The gate below is what keeps that in hand.
 */

describe('the facet count gate', () => {
  /** Runs `total` pieces of work through a gate and reports the high-water
   * mark of how many were ever in flight at the same time. */
  async function highWaterMark(limit: number, total: number) {
    const gate = createLimiter(limit);
    let running = 0;
    let peak = 0;
    const order: number[] = [];
    await Promise.all(
      Array.from({ length: total }, (_, index) =>
        gate(async () => {
          running += 1;
          peak = Math.max(peak, running);
          await new Promise((resolve) => setTimeout(resolve, 1));
          order.push(index);
          running -= 1;
          return index;
        }),
      ),
    );
    return { peak, order };
  }

  it('never lets more than the limit run at once', async () => {
    const { peak } = await highWaterMark(8, 200);
    expect(peak).toBe(8);
  });

  it('lets everything run when there is less work than the limit', async () => {
    const { peak } = await highWaterMark(8, 3);
    expect(peak).toBe(3);
  });

  it('still returns every result, in the caller’s order', async () => {
    const gate = createLimiter(4);
    const results = await Promise.all(
      [5, 1, 4, 2, 3, 6].map((value) =>
        gate(async () => {
          await new Promise((resolve) => setTimeout(resolve, value));
          return value;
        }),
      ),
    );
    /* Promise.all keeps the order of the array, not of completion. */
    expect(results).toEqual([5, 1, 4, 2, 3, 6]);
  });

  it('runs every piece of work exactly once', async () => {
    const { order } = await highWaterMark(3, 50);
    expect(order).toHaveLength(50);
    expect(new Set(order).size).toBe(50);
  });

  it('releases its slot when the work throws, instead of wedging', async () => {
    /* A failed count must not hold a slot for the rest of the request --
       with the gate stuck the page would hang rather than answer. */
    const gate = createLimiter(2);
    const settled = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) =>
        gate(async () => {
          if (index % 2 === 0) throw new Error(`boom ${index}`);
          return index;
        }),
      ),
    );
    expect(settled.filter((row) => row.status === 'rejected')).toHaveLength(5);
    expect(settled.filter((row) => row.status === 'fulfilled')).toHaveLength(5);
  });

  it('keeps working after a batch that threw', async () => {
    const gate = createLimiter(1);
    await Promise.allSettled([
      gate(() => Promise.reject(new Error('first'))),
      gate(() => Promise.reject(new Error('second'))),
    ]);
    await expect(gate(() => Promise.resolve('still open'))).resolves.toBe(
      'still open',
    );
  });
});
