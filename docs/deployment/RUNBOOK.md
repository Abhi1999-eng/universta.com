# Universta deployment runbook

## Automatic main deployment

`.github/workflows/ci.yml` is the single CI/CD workflow.

- Pull requests run database validation, migrations against CI MySQL, safe
  foundation and demo seeding, unit tests, API E2E, browser E2E, lint, all
  three production builds, and a clean-output check.
- Pull requests never receive an OIDC token and never run a deployment job.
- A push to `main` repeats the complete CI suite, packages the exact
  `github.sha`, uploads the private SHA-addressed artifact, deploys through
  SSM, and verifies the public endpoints.
- Automatic deployments run only the safe foundation seed. The fictional demo
  catalog is never reseeded after initial provisioning.
- A failed validation job prevents deployment.
- A failed deployment health check atomically restores the previous
  application release and leaves the workflow failed.

The deployment applies forward Prisma migrations before switching the
application release. Application rollback does not reverse database
migrations; destructive or backward-incompatible migrations require a
separate reviewed database rollback plan.

## One-time initial demo catalog seed

Run the fictional demo catalog seed only once, during initial provisioning and
before Admin-managed catalog editing begins. From an authorized SSM session:

```bash
sudo -u universta bash -lc '
  set -a
  source /opt/universta/shared/env/api.env
  set +a
  cd /opt/universta/current
  SEED_DEMO_CATALOG=true npm --workspace apps/api run db:seed:demo
'
```

Do not add `SEED_DEMO_CATALOG` to the persistent runtime environment and do not
run this command as part of an automatic deployment.

## One-time CountrySubject backfill

Countries carry their Subjects directly, in `country_subjects`. Existing
countries have no rows there until this backfill seeds them from the published
catalogue, so the public "Subjects" block on a country page stays empty until it
has run.

Run it **once**, in this order, after the release that contains migration
`20260901090000_country_client_contract`:

1. Deploy the schema migration. The automatic deployment already runs
   `npm run db:migrate:deploy`; confirm it reported the migration as applied.
2. Deploy the application (API, Admin and Web) and confirm the services are
   healthy — see **Release verification** below.
3. Run the backfill once, from an authorized SSM session:

   ```bash
   sudo -u universta bash -lc '
     set -a
     source /opt/universta/shared/env/api.env
     set +a
     cd /opt/universta/current
     npm --workspace apps/api run db:backfill:country-subjects
   '
   ```

4. Optionally run the same command a second time purely to confirm
   idempotency: the row count in step 5 must not change. The statement is
   `INSERT IGNORE` against a unique `(country_id, subject_id)`, so a repeat
   inserts nothing new.
5. Verify the rows landed:

   ```bash
   sudo -u universta bash -lc '
     set -a
     source /opt/universta/shared/env/api.env
     set +a
     mysql --protocol=TCP -h "$DATABASE_HOST" -P "$DATABASE_PORT" \
       -u "$DATABASE_USER" -p"$DATABASE_PASSWORD" "$DATABASE_NAME" -e "
       SELECT COUNT(*) AS country_subject_rows FROM country_subjects;
       SELECT c.name, COUNT(cs.id) AS subjects
       FROM countries c
       LEFT JOIN country_subjects cs ON cs.country_id = c.id
       WHERE c.deleted_at IS NULL AND c.status = \"PUBLISHED\"
       GROUP BY c.id ORDER BY subjects DESC LIMIT 10;"
   '
   ```

6. Open two or three of those countries on the public site
   (`/countries/<slug>`) and confirm the Subjects section lists them.

**Never automate this.** It must not run at API startup, on every deployment,
or on a schedule. It only ever adds rows, so re-running it restores a Subject an
editor has deliberately removed from a country. Once editors own the taxonomy,
removals must stay removed.

**Rollback.** `country_subjects` is additive data that no earlier release
reads. Rolling the application back does **not** require deleting those rows and
you should not delete them — a forward redeploy would only have to backfill
again. Roll back the application by release as usual; leave the table alone.

## Manual operations

Open the `CI` workflow in GitHub Actions and choose **Run workflow**.

### Deploy an exact SHA

1. Select action `deploy`.
2. Enter the exact 40-character Git commit SHA.
3. Run the workflow.

The complete CI suite runs against that checkout before any AWS action.

### Roll back

1. Select action `rollback`.
2. Leave SHA empty to use `/opt/universta/previous`, or enter a retained exact
   SHA from `/opt/universta/releases`.
3. Run the workflow.

The rollback is accepted only when the target is a complete immutable release.
All three services must pass health checks or the original release is restored.

### Inspect status

Select action `status`. The SSM output reports:

- current and previous SHAs;
- API, Web, Admin, Nginx, and MySQL systemd states;
- API/database health.

### Seed or inspect the marker-scoped QA dataset

The `qa-seed`, `qa-report`, and `qa-cleanup` actions are manual **demo-only**
operations. They never run as part of CI or automatic deployment.

- `qa-seed` requires the repository secrets
  `QA_FORGE_E2E_ADMIN_PASSWORD` and `QA_FORGE_E2E_STUDENT_PASSWORD`. It creates
  only the marker-owned fictional catalog and QA accounts used for acceptance.
- `qa-report` returns non-secret record counts and manifest readiness.
- `qa-cleanup` is manifest-gated and refuses cleanup when non-QA records depend
  on the dataset. Do not run cleanup while a handoff or acceptance session is
  still using the dataset.

Select the relevant action in **Run workflow**. Do not invoke the normal demo
catalog command against the demo host; the QA operation carries the required
explicit guards and preserves Admin-owned global content.

## Direct operator diagnostics

All commands use SSM; SSH is intentionally unavailable.

```bash
aws ssm send-command \
  --region us-east-1 \
  --instance-ids i-0288a3283c26638b3 \
  --document-name AWS-RunShellScript \
  --parameters '{"commands":["bash /opt/universta/current/scripts/deployment/status.sh"]}'
```

To inspect a service without exposing secrets:

```bash
aws ssm send-command \
  --region us-east-1 \
  --instance-ids i-0288a3283c26638b3 \
  --document-name AWS-RunShellScript \
  --parameters '{"commands":["systemctl status --no-pager universta-api universta-web universta-admin","tail -n 100 /opt/universta/shared/logs/api.log"]}'
```

## Release verification

For a deployed SHA:

```bash
aws s3api head-object \
  --region us-east-1 \
  --bucket universta-demo-artifacts-771413672221-us-east-1 \
  --key releases/<sha>/universta-<sha>.tar.gz
```

On the instance, `DEPLOYMENT_SHA` in the current release must equal the
`current` symlink basename. The deployment script verifies this before
switching.

## HTTPS activation

When an owned hosted zone is available:

1. Create Web and Admin records pointing to `54.162.49.131`.
2. Issue and install a trusted certificate suitable for direct Nginx use.
3. Add Nginx 443 virtual hosts and redirect port 80 to HTTPS.
4. update `/universta/demo/runtime/web-origin`,
   `/universta/demo/runtime/admin-origin`, and
   `/universta/demo/runtime/api-origin`;
5. update the non-secret workflow endpoint constants;
6. change the API runtime environment from the HTTP demo policy only after
   demo-catalog requirements are reviewed;
7. run full CI and deploy an exact `main` SHA;
8. verify secure refresh-cookie rotation and all public-to-Admin flows.

Do not collect real counselling data while the HTTP fallback is active.
