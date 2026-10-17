/**
 * Publishing a subject publishes the subject alone. Its specializations are
 * published one by one, each on its own -- from its editor or from the
 * Specializations list. Publishing a subject used to publish every draft
 * under it as well, half-written ones included.
 *
 * What is said once a subject is published names the drafts it left behind,
 * so nobody takes them for live. `owner` is "Its" for one subject and
 * "Their" for several published together.
 */
export function draftSpecializationsNote(
  children: ReadonlyArray<{ status: string }> | undefined,
  owner: 'Its' | 'Their' = 'Its',
): string {
  const drafts = (children ?? []).filter((child) => child.status !== 'PUBLISHED').length;
  if (!drafts) return '';
  return drafts === 1
    ? `${owner} draft specialization stays off the site until it is published on its own.`
    : `${owner} ${drafts} draft specializations stay off the site until each is published on its own.`;
}

/** A published message with the drafts note after it, when there is one. */
export function withDraftsNote(message: string, note: string): string {
  return note ? `${message} ${note}` : message;
}
