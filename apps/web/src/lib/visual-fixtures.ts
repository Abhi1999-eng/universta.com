/**
 * Visual fixtures are deliberately disabled in production. The parity runner
 * enables them only for a local/E2E process with VISUAL_FIXTURE_MODE=true.
 */
export function isVisualFixtureMode() {
  return process.env.NODE_ENV !== 'production' && process.env.VISUAL_FIXTURE_MODE === 'true';
}
