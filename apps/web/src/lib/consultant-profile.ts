/**
 * What a consultant's own record may say on its pages, read defensively:
 * the API that serves it is older than some of these rules, so each one
 * holds whatever the record carries.
 */

/**
 * An address a link may point at: absolute, http or https, with a host.
 *
 * The admin accepted whatever was typed into Website URL and Source URL,
 * and a profile rendered "www.example.test" as a link relative to itself
 * (a 404 on our own site) and a note like "Checked by phone with the
 * office" as a link to nowhere. Anything else is shown as text, not
 * linked.
 */
export function externalHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname ? trimmed : null;
  } catch {
    return null;
  }
}

/** An address as a reader reads it: without the scheme. */
export function displayUrl(value: string): string {
  return value.trim().replace(/^https?:\/\//i, '');
}

/**
 * Whether a consultant is verified, and when.
 *
 * A date means something only beside VERIFIED. Records that are PENDING
 * or UNVERIFIED can still carry an old date -- a check that was later
 * withdrawn, a seed -- and printing it read "Not yet verified ... Last
 * verified 1 Oct 2026". A verified record with no date says so, rather
 * than "Not verified" beside a Verified badge.
 */
export function consultantVerification(
  status: unknown,
  verifiedAt: unknown,
): { verified: boolean; verifiedAt: string | null } {
  const verified = status === 'VERIFIED';
  const date =
    verified && typeof verifiedAt === 'string' && verifiedAt.trim() && !Number.isNaN(Date.parse(verifiedAt))
      ? verifiedAt.trim()
      : null;
  return { verified, verifiedAt: date };
}
