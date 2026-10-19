/**
 * What a consultant's own record may say on its pages, read defensively:
 * the API that serves it is older than some of these rules, so each one
 * holds whatever the record carries.
 */

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
