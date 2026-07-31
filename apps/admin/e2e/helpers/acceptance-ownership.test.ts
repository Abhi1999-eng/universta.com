// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  assertLocalDatabase,
  acceptanceOwnership,
} from './acceptance-cleanup';
import {
  ACCEPTANCE_EMAIL_DOMAIN,
  acceptanceEmail,
  acceptanceEmailSuffix,
  acceptanceRunId,
  acceptanceSlugPrefix,
  acceptanceTextPrefix,
} from './acceptance-run';

/** Cleanup issues `deleteMany`. These tests pin the two things standing
 * between that and data loss: the predicates only ever describe the current
 * run's own records, and the guard refuses any database that is not local. */

const THIS_RUN = 'aaaa1111bbbb';
const OTHER_RUN = 'cccc2222dddd';

/** Reimplements what Prisma's string filters mean, so a predicate can be
 * checked against concrete values without a database. */
function matches(
  filter: { startsWith?: string; endsWith?: string; equals?: string },
  value: string,
): boolean {
  if (filter.startsWith !== undefined) return value.startsWith(filter.startsWith);
  if (filter.endsWith !== undefined) return value.endsWith(filter.endsWith);
  return value === filter.equals;
}

describe('acceptance ownership predicates', () => {
  const own = acceptanceOwnership(THIS_RUN);
  const other = acceptanceOwnership(OTHER_RUN);

  it('matches records this run created', () => {
    expect(matches(own.email, acceptanceEmail('contact', THIS_RUN))).toBe(true);
    expect(matches(own.slug, `${acceptanceSlugPrefix(THIS_RUN)}university`)).toBe(
      true,
    );
    expect(
      matches(own.text, `${acceptanceTextPrefix(THIS_RUN)} testimonial`),
    ).toBe(true);
  });

  it('leaves records from a different run untouched', () => {
    // The failure this prevents: two acceptance runs overlapping, and the
    // first to finish deleting the second one's data mid-test.
    expect(matches(own.email, acceptanceEmail('contact', OTHER_RUN))).toBe(
      false,
    );
    expect(
      matches(own.slug, `${acceptanceSlugPrefix(OTHER_RUN)}university`),
    ).toBe(false);
    expect(
      matches(own.text, `${acceptanceTextPrefix(OTHER_RUN)} testimonial`),
    ).toBe(false);
    expect(own.continentName).not.toBe(other.continentName);
    expect(own.countryName).not.toBe(other.countryName);
  });

  it('leaves a genuine address that merely contains "example.invalid" untouched', () => {
    // The predicate this replaced was `contains: 'example.invalid'`, which
    // matched every address below and would have deleted a real enquiry.
    const genuine = [
      'example.invalid@gmail.com',
      'user.example.invalid@company.com',
      'example.invalidate@university.edu',
      'contact@notexample.invalid.com',
      'someone@example.invalid.example.com',
    ];
    for (const address of genuine) {
      expect({ address, matched: matches(own.email, address) }).toEqual({
        address,
        matched: false,
      });
    }
  });

  it('leaves a genuine address at the reserved domain untouched', () => {
    // Even inside example.invalid, ownership is the full run-scoped suffix --
    // the domain alone is not a licence to delete.
    for (const address of [
      `someone@${ACCEPTANCE_EMAIL_DOMAIN}`,
      `deploy-acceptance@${ACCEPTANCE_EMAIL_DOMAIN}`,
      `contact.deploy-acceptance-@${ACCEPTANCE_EMAIL_DOMAIN}`,
    ]) {
      expect({ address, matched: matches(own.email, address) }).toEqual({
        address,
        matched: false,
      });
    }
  });

  it('anchors every predicate rather than searching inside a value', () => {
    // A `contains` filter anywhere here would reintroduce the original defect.
    for (const [name, filter] of Object.entries({
      slug: own.slug,
      text: own.text,
      email: own.email,
    })) {
      expect({ name, keys: Object.keys(filter as object) }).toEqual({
        name,
        keys: [name === 'email' ? 'endsWith' : 'startsWith'],
      });
    }
  });

  it('embeds the run id in every marker', () => {
    for (const marker of [
      acceptanceSlugPrefix(THIS_RUN),
      acceptanceTextPrefix(THIS_RUN),
      acceptanceEmailSuffix(THIS_RUN),
      own.continentName,
      own.countryName,
    ]) {
      expect({ marker, carriesRunId: marker.includes(THIS_RUN) }).toEqual({
        marker,
        carriesRunId: true,
      });
    }
  });
});

describe('acceptanceRunId', () => {
  it('reuses an id supplied through the environment, so workers agree with teardown', () => {
    const previous = process.env.ACCEPTANCE_RUN_ID;
    process.env.ACCEPTANCE_RUN_ID = THIS_RUN;
    try {
      expect(acceptanceRunId()).toBe(THIS_RUN);
    } finally {
      if (previous === undefined) delete process.env.ACCEPTANCE_RUN_ID;
      else process.env.ACCEPTANCE_RUN_ID = previous;
    }
  });

  it('rejects an id that would be unsafe inside a slug or address', () => {
    const previous = process.env.ACCEPTANCE_RUN_ID;
    // A wildcard here would widen every predicate at once.
    process.env.ACCEPTANCE_RUN_ID = '%';
    try {
      expect(() => acceptanceRunId()).toThrow(/must match/);
    } finally {
      if (previous === undefined) delete process.env.ACCEPTANCE_RUN_ID;
      else process.env.ACCEPTANCE_RUN_ID = previous;
    }
  });
});

describe('local-database guard', () => {
  it('accepts a loopback database', () => {
    for (const url of [
      'mysql://user:pw@127.0.0.1:3306/universta',
      'mysql://user:pw@localhost:3306/universta',
      'mysql://user:pw@localhost/universta',
    ]) {
      expect(() => assertLocalDatabase(url)).not.toThrow();
    }
  });

  it('refuses a hosted database', () => {
    for (const url of [
      'mysql://user:pw@db.internal:3306/universta',
      'mysql://user:pw@10.0.0.5:3306/universta',
      'mysql://user:pw@universta.abcdef.us-east-1.rds.amazonaws.com:3306/universta',
      'mysql://user:pw@54.162.49.131:3306/universta',
    ]) {
      expect(() => assertLocalDatabase(url)).toThrow(/non-local database/);
    }
  });

  it('refuses a missing database url rather than defaulting to one', () => {
    expect(() => assertLocalDatabase(undefined)).toThrow(/required/);
    expect(() => assertLocalDatabase('')).toThrow(/required/);
  });
});

describe('cleanup helpers stay out of the application', () => {
  /** Walks a source tree collecting file contents, so an import of the
   * cleanup helper from shipped code fails the build rather than shipping a
   * `deleteMany` path into the app. */
  function sourceFiles(dir: string): string[] {
    const found: string[] = [];
    const walk = (current: string) => {
      for (const entry of readdirSync(current)) {
        if (entry === 'node_modules' || entry === '.next') continue;
        const full = join(current, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) found.push(full);
      }
    };
    walk(dir);
    return found;
  }

  it('is never imported by admin, web or api application code', () => {
    const root = resolve(__dirname, '../../../..');
    const trees = [
      join(root, 'apps/admin/src'),
      join(root, 'apps/web/src'),
      join(root, 'apps/api/src'),
    ];
    const offenders: string[] = [];
    for (const tree of trees) {
      for (const file of sourceFiles(tree)) {
        const source = readFileSync(file, 'utf8');
        if (/acceptance-(cleanup|run)/.test(source)) {
          offenders.push(file.slice(root.length + 1));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
