import { randomUUID } from 'node:crypto';

/** Ownership markers for the records an acceptance run creates.
 *
 * Cleanup deletes rows. What it deletes is decided entirely here, so the rule
 * this module exists to enforce is worth stating plainly: **a record belongs to
 * a run only if it carries that run's own id.** Nothing is matched by a shared
 * substring like `example.invalid`, because a substring match cannot tell the
 * difference between this run's data, another run's data, and a real record
 * that merely happens to contain the same text.
 *
 * Every marker below therefore embeds `acceptanceRunId()`, and every cleanup
 * predicate anchors on the marker rather than searching inside a value. */

const RUN_ID_ENV = 'ACCEPTANCE_RUN_ID';
/** Lowercase alphanumerics only: the id is embedded in slugs and email local
 * parts, so anything else would either be invalid there or change meaning
 * after normalisation. */
const RUN_ID_PATTERN = /^[a-z0-9]{8,32}$/;

/** Reserved by RFC 2606 and guaranteed never to resolve, so a run's addresses
 * can never reach a real person. It is *not* by itself an ownership signal --
 * see the module comment. */
export const ACCEPTANCE_EMAIL_DOMAIN = 'example.invalid';
/** Names the purpose of the address in the record itself, so anyone looking at
 * a stray row in the database can tell what created it. */
export const ACCEPTANCE_EMAIL_PREFIX = 'deploy-acceptance-';

/** The id shared by every record this run creates.
 *
 * Established once in the Playwright config, before any worker is forked, and
 * exported through the environment so workers and the global teardown all
 * agree on it. A worker that generated its own id would create records the
 * teardown could not recognise -- which is why this reads the environment
 * first and only generates as a fallback. */
export function acceptanceRunId(): string {
  const existing = process.env[RUN_ID_ENV];
  if (existing) {
    if (!RUN_ID_PATTERN.test(existing)) {
      throw new Error(
        `${RUN_ID_ENV} must match ${RUN_ID_PATTERN} so it is safe to embed in slugs and email addresses; received "${existing}"`,
      );
    }
    return existing;
  }
  const generated = randomUUID().replace(/-/g, '').slice(0, 12);
  process.env[RUN_ID_ENV] = generated;
  return generated;
}

/** Slug prefix for catalogue records created by this run. */
export function acceptanceSlugPrefix(runId: string = acceptanceRunId()): string {
  return `acceptance-demo-${runId}-`;
}

/** Visible-text prefix for names, titles and quotes created by this run.
 *
 * Reads as obviously fictional in a screenshot, which matters because these
 * records are sometimes visible during a demo before cleanup runs. */
export function acceptanceTextPrefix(runId: string = acceptanceRunId()): string {
  return `Acceptance Demo ${runId}`;
}

/** The exact address suffix that marks an email as owned by this run.
 *
 * Ownership is the whole suffix, not the domain: `endsWith` on
 * `.deploy-acceptance-<runId>@example.invalid` matches this run's addresses and
 * nothing else. A genuine address that happens to contain "example.invalid" in
 * its local part -- `example.invalid.user@gmail.com` -- does not end with it,
 * and neither does an address from a different run. */
export function acceptanceEmailSuffix(runId: string = acceptanceRunId()): string {
  return `.${ACCEPTANCE_EMAIL_PREFIX}${runId}@${ACCEPTANCE_EMAIL_DOMAIN}`;
}

/** Builds an owned address, e.g. `contact.deploy-acceptance-a1b2c3@example.invalid`. */
export function acceptanceEmail(
  label: string,
  runId: string = acceptanceRunId(),
): string {
  return `${label}${acceptanceEmailSuffix(runId)}`;
}

/** Location fixtures. Named rather than slug-marked because Continent has no
 * slug column, and a demo once showed one of these as a study destination. */
export function acceptanceContinentName(
  runId: string = acceptanceRunId(),
): string {
  return `Browser Region E2E ${runId}`;
}

export function acceptanceCountryName(runId: string = acceptanceRunId()): string {
  return `Browser Country E2E ${runId}`;
}
