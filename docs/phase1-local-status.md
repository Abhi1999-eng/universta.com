# Expanded Phase 1 local acceptance status

This matrix records only checks executed against the local worktree and local
MySQL. “Partial” means the product exists but the complete acceptance matrix
has not yet been executed; it is not a release sign-off.

| Area | Status | Evidence / scope exercised | Remaining work |
| --- | --- | --- | --- |
| Admin authentication | pass | API auth E2E: 11 tests; isolated browser auth: 4 tests. Empty, malformed, invalidly-signed and revoked sessions redirect before protected rendering; login, safe return targets and logout were exercised. | Add a dedicated browser assertion for a naturally expired persisted cookie. |
| Structured Admin CRUD | pass | `phase1-structured-crud.spec.ts`: 8 browser workflows for University, Offering, Scholarship, Consultant, Job, Event, Success Story and Testimonial. Includes create, validation, edit, reload, relationships, publish/unpublish and archive confirmation. | Add explicit relationship-removal coverage and a 390px Admin form assertion. |
| Publish / unpublish | partial | The eight browser workflows verified Admin listing visibility and public listing visibility through publish/unpublish/re-publish. | Execute the full public API/detail-route exclusion matrix for every resource. |
| Contact-to-Lead conversion | not run in this pass | Existing implementation was not changed. | Execute valid/invalid inquiry, idempotent conversion and history/audit browser checks. |
| Public subject/course catalog | pass | `public-catalog.spec.ts`: 17 browser tests for search suggestions, keyboard selection, URL state, filters, pagination, Back/Forward, mobile drawer, menu, counselling context and overflow. | Run an expanded-route page-by-page acceptance sweep. |
| Four comparisons | pass | `phase1-comparisons.spec.ts`: 4 browser tests with three published records each; form selection, URL order, reload, Back/Forward, canonical/noindex metadata and 390px stack/overflow were verified. | Add explicit duplicate, invalid and unpublished item cases. |
| Course hierarchy and SEO | partial | Course filtering and detail/discovery routes were covered by the public browser catalog suite; comparison canonical/noindex metadata was checked. | Execute legacy redirect, invalid hierarchy, sitemap and robots inclusion/exclusion matrix. |
| Responsive/accessibility | partial | Public catalog 320/390/768 overflow/menu coverage; structured field errors are programmatically associated; archive dialog is keyboard-labelled. | Execute full Admin 390px and all expanded public route viewport checks. |
| Demo seed idempotency | pass | Explicit local demo seed ran twice with stable fictional records: 3 universities, 4 campuses, 8 offerings, 5 scholarships, 4 consultants, 3 locations, 3 jobs, 4 events, 3 stories and 5 testimonials. | None in this focused pass. |
| Build and package integrity | pass | API, Admin and Web production builds passed. `npm ci --ignore-scripts --dry-run` passed. Next’s generated platform SWC lock mutation was restored. | Run the full repository suite only after every outstanding matrix is complete. |

## Local fixes in this pass

- Server-side Admin session validation remains authoritative and refresh-cookie
  validity is checked before protected content renders.
- Structured editor form options are available through the authenticated BFF.
- Typed dates/numbers are normalized before Prisma writes; nullable field
  clearing and partial PATCH semantics are preserved.
- Editor fields stay disabled until relation options and edit data hydrate.
- Event range errors and select errors are associated with their controls.
- Job published date and Testimonial quote hydration are supported.
- Listing-only Success Story/Testimonial pages no longer advertise dead detail
  links.

## Current local tree

- Branch: `feat/phase1-expanded-local`
- No remote, deployment, schema or migration changes were made in this pass.
- Browser artifacts are kept outside the repository under `/tmp`.
