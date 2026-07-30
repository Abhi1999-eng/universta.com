import {
  countAcceptanceRecords,
  purgeAcceptanceRecords,
  totalAcceptanceRecords,
} from './helpers/acceptance-cleanup';

/** Runs once after the whole Playwright suite, including after failures.
 *
 * The structured-CRUD spec cleans up after itself, but a run that crashes
 * between creating a record and reaching its own afterAll would still leave
 * rows behind. This is the backstop that makes "repeated runs leave zero
 * acceptance records" true regardless of how the run ended. */
export default async function globalTeardown() {
  const removed = await purgeAcceptanceRecords();
  const total = totalAcceptanceRecords(removed);
  if (total > 0) {
    console.log(
      `[acceptance-cleanup] removed ${total} leftover acceptance record(s):`,
      Object.entries(removed)
        .filter(([, count]) => count > 0)
        .map(([name, count]) => `${name}=${count}`)
        .join(' '),
    );
  }
  const remaining = totalAcceptanceRecords(await countAcceptanceRecords());
  if (remaining > 0) {
    throw new Error(
      `[acceptance-cleanup] ${remaining} acceptance record(s) still present after teardown`,
    );
  }
}
