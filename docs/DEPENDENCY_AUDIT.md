# Dependency audit

Audit date: 2026-07-24

Commands run from the repository root:

```bash
npm audit
npm audit --omit=dev
```

Both commands reported 7 findings: 6 high, 1 moderate, 0 critical, 0 low,
and 0 informational.

| Package/finding | Severity | Dependency path | Runtime relevance | Action |
| --- | --- | --- | --- | --- |
| `find-my-way` / GHSA-c96f-x56v-gq3h HTTP/2 DoS | High | transitive via `@prisma/dev` → `prisma` | Development/migration tooling | Not forced; review Prisma release compatibility |
| `@prisma/dev` | High | transitive Prisma tooling package | Development/migration tooling | Not forced; follows Prisma remediation |
| `prisma` | High | direct in `apps/api` devDependencies | Development/migration tooling | Not changed; verified Prisma 7.9.0 retained |
| `postcss` / GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849 | High | transitive via `next` in web/admin | Build tooling and framework pipeline | No unsafe framework downgrade applied |
| `sharp` / CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 | High | transitive via `next` in web/admin | Next image/build dependency | No unsafe framework downgrade applied |
| `next` | High | direct in `apps/web` and `apps/admin` | Framework dependency | Requires a controlled compatible Next upgrade review |
| `valibot` / GHSA-5qjj-4xww-7phc | Moderate | transitive via `@prisma/dev` | Development/migration tooling | Not forced; review with Prisma upgrade |

The audit was rerun after adding the TASK_001 dependencies. The direct
`@nestjs/swagger` path was pinned to 11.4.5, which uses the clean `js-yaml`
4.3.0 path; the newly introduced Swagger advisory is not present in the final
audit. The remaining findings are existing framework/Prisma dependency paths
or their refreshed transitive graph.

`npm audit --omit=dev` reports the same workspace graph because workspace
manifests and installed framework packages remain included in the root audit
tree; it does not establish that every finding is shipped in a production
bundle. Prisma and Valibot are development/migration tooling paths. Next,
PostCSS, and sharp require a controlled framework upgrade review.

No non-breaking remediation was applied automatically, and
`npm audit fix --force` was not run. The remaining audit risk is documented for
future dependency review before production deployment.
