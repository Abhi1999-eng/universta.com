import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The CountrySubject backfill is a deliberate one-time deployment step, not
 * something the application does for itself. A step nobody wrote down is a step
 * that gets skipped, so the runbook has to carry it — and has to keep saying
 * that it runs once.
 */
describe('CountrySubject backfill deployment step', () => {
  const runbook = readFileSync(
    join(__dirname, '../../../../docs/deployment/RUNBOOK.md'),
    'utf8',
  );

  it('documents the exact command', () => {
    expect(runbook).toContain(
      'npm --workspace apps/api run db:backfill:country-subjects',
    );
  });

  it('names the migration it follows and the order of the steps', () => {
    expect(runbook).toContain('20260901090000_country_client_contract');
    expect(runbook).toMatch(/deploy the schema migration/i);
  });

  it('says it runs once and must not be automated', () => {
    expect(runbook).toMatch(/run it \*\*once\*\*|Run it \*\*once\*\*/);
    expect(runbook).toContain('Never automate this');
  });

  it('gives rollback guidance that keeps the rows', () => {
    expect(runbook).toMatch(/does \*\*not\*\* require deleting those rows/);
  });

  it('is wired to a real npm script', () => {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, '../../package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts['db:backfill:country-subjects']).toBe(
      'tsx prisma/backfill-country-subjects.ts',
    );
  });
});
