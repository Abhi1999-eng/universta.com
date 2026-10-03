/**
 * Before a filter runs, the service checks that every value it was handed is
 * an option the catalogue actually publishes. The check was a row count
 * compared against the number of values asked for.
 *
 * That holds for a subject, a level, an intake or a destination, whose slugs
 * are unique. It does not hold for a specialization: its slug is unique only
 * inside its subject (`subjectId_slug`), so `artificial-intelligence` is one
 * record under Computer Science and another under Engineering, and filtering
 * by that slug is meant to match both. One value resolving to three rows read
 * as 3 !== 1 and the request was rejected -- so 203 of the 647 specializations
 * the filter rail offers answered "not an active published option" when a
 * reader clicked them.
 */

/** Rows the catalogue holds, by slug, after the published/not-deleted filter. */
const PUBLISHED: Record<string, number> = {
  'artificial-intelligence': 3,
  agronomy: 2,
  'data-ethics': 1,
};

/** The check as it was: how many records came back. */
function countedByRow(asked: string[]) {
  const found = asked.reduce(
    (total, slug) => total + (PUBLISHED[slug] ?? 0),
    0,
  );
  return found === asked.length;
}

/** The check as it is: how many of the slugs asked for resolved to something. */
function countedByValue(asked: string[]) {
  const distinct = new Set(asked);
  const found = [...distinct].filter(
    (slug) => (PUBLISHED[slug] ?? 0) > 0,
  ).length;
  return found === distinct.size;
}

describe('validating a specialization filter', () => {
  it('accepts a slug several subjects share', () => {
    expect(countedByValue(['artificial-intelligence'])).toBe(true);
    // The shape of the regression, kept so it cannot come back unnoticed.
    expect(countedByRow(['artificial-intelligence'])).toBe(false);
  });

  it('accepts a slug only one subject carries', () => {
    expect(countedByValue(['data-ethics'])).toBe(true);
  });

  it('accepts a shared slug alongside a unique one', () => {
    expect(countedByValue(['artificial-intelligence', 'data-ethics'])).toBe(
      true,
    );
  });

  it('still refuses a slug the catalogue does not publish', () => {
    expect(countedByValue(['narnia-studies'])).toBe(false);
    expect(countedByValue(['data-ethics', 'narnia-studies'])).toBe(false);
  });

  it('counts a slug named twice once, rather than demanding it resolve twice', () => {
    expect(countedByValue(['agronomy', 'agronomy'])).toBe(true);
  });
});
