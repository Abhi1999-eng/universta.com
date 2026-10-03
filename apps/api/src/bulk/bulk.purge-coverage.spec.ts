import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BULK_RESOURCES } from './bulk-resources';

/**
 * Which resources a hard delete can actually clear, and why.
 *
 * `bulk-delete` is one generic path over every bulk resource, so nothing
 * has to be written per resource for it to be reachable. What has to be
 * written is a `purgeChildren` hook, and only where the schema restricts a
 * reference the record owns -- MySQL refuses the delete while that row
 * stands, and without the hook the operator gets a foreign-key error they
 * can do nothing about.
 *
 * Campuses and offerings need no hook today: everything pointing at them
 * either cascades or nulls. That is a fact about the schema rather than
 * about this file, so it is asserted against the schema -- a `Restrict`
 * added to either of them later should fail here rather than in production.
 */

const schema = readFileSync(
  join(__dirname, '..', '..', 'prisma', 'schema.prisma'),
  'utf8',
);

/** Whether a resource declares a hook, without touching the method itself:
 * reading it off the object to compare is an unbound reference. */
const hasHook = (key: string) =>
  Object.prototype.hasOwnProperty.call(BULK_RESOURCES[key], 'purgeChildren');

/** Every relation that points at `model` and would block its deletion. */
function restrictedBy(model: string): string[] {
  const blockers: string[] = [];
  let current = '';
  for (const line of schema.split('\n')) {
    const header = /^model (\w+) \{/.exec(line);
    if (header) {
      current = header[1];
      continue;
    }
    const relation = new RegExp(
      `\\s${model}\\??\\s+@relation\\(.*references: \\[id\\](.*)\\)`,
    ).exec(line);
    if (!relation) continue;
    const rest = relation[1];
    if (rest.includes('Cascade') || rest.includes('SetNull')) continue;
    blockers.push(current);
  }
  return blockers;
}

describe('every bulk resource is reachable by a hard delete', () => {
  it('needs no per-resource wiring to be deletable', () => {
    // The endpoint takes `:resource`, so the registry is the whole list.
    expect(Object.keys(BULK_RESOURCES)).toEqual(
      expect.arrayContaining([
        'countries',
        'subjects',
        'universities',
        'courses',
        'campuses',
        'offerings',
      ]),
    );
  });
});

describe('what each resource has to clear before it can go', () => {
  it.each([
    ['campuses', 'UniversityCampus'],
    ['offerings', 'UniversityCourseOffering'],
  ])('%s needs no hook, because nothing restricts %s', (key, model) => {
    expect(restrictedBy(model)).toEqual([]);
    expect(hasHook(key)).toBe(false);
  });

  it.each([
    ['courses', 'Course'],
    ['subjects', 'Subject'],
    ['countries', 'Country'],
  ])('%s has a hook, because %s is restricted', (key, model) => {
    expect(restrictedBy(model).length).toBeGreaterThan(0);
    expect(hasHook(key)).toBe(true);
  });

  it('leaves a university to the schema, which cascades its children', () => {
    // Only a student application restricts it, and that is meant to block.
    expect(restrictedBy('University')).toEqual(['StudentApplication']);
    expect(hasHook('universities')).toBe(false);
  });
});
