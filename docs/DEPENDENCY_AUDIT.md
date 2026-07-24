# Dependency audit

Audit date: 2026-07-24

Commands run from the repository root:

```bash
npm audit
npm audit --omit=dev
```

Both commands reported 6 high-severity vulnerabilities, 0 critical, 0 moderate, 0 low, and 0 informational findings.

| Package/finding | Severity | Dependency path | Runtime relevance | Reported remediation | Action |
| --- | --- | --- | --- | --- | --- |
| `find-my-way` / GHSA-c96f-x56v-gq3h HTTP/2 DoS | High | transitive via `@prisma/dev` → `prisma` | Development/migration tooling | `npm audit fix --force` would install Prisma 7.8.0 and is marked breaking | Not applied; review Prisma release compatibility first |
| `@prisma/dev` | High | transitive Prisma tooling package | Development/migration tooling | Same forced Prisma change | Not applied |
| `prisma` | High | direct in `apps/api` devDependencies | Development/migration tooling | Forced downgrade/change to 7.8.0 | Not applied; current 7.9.0 is the verified migration tool |
| `postcss` / GHSA-qx2v-qp2m-jg93 and GHSA-6g55-p6wh-862q | High | transitive via `next` in web/admin | Build tooling and framework pipeline | Forced change would install Next 9.3.3 | Not applied; this is a major, unsafe downgrade |
| `sharp` / CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 | High | transitive via `next` in web/admin | Next image/build dependency | Forced change would install Next 9.3.3 | Not applied; this is a major, unsafe downgrade |
| `next` | High | direct in `apps/web` and `apps/admin` | Framework dependency | Audit's forced remediation points to Next 9.3.3 | Not applied; this is an incompatible major downgrade |

`npm audit --omit=dev` reports the same workspace graph because the workspace manifests and installed framework packages are still included in the root audit tree; it does not establish that every finding is shipped in a production bundle. The Prisma findings are development/migration tooling. Next/PostCSS/sharp require a controlled framework upgrade review rather than `--force`.

No non-breaking patch/minor remediation was offered by npm. No dependency change was made, and `npm audit fix --force` was intentionally not run. The verified validation remains the current baseline: lint, tests, Prisma validation/generation, and web/admin/API builds pass.

Unresolved risk: review current vendor advisories and plan compatible Next.js/Prisma upgrades before production deployment. Run the audit again after each approved upgrade.
