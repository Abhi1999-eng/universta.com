# TASK_006A — Country Experience Completion

Status: implementation on `feat/task-006a-country-experience-completion`

## Scope

TASK_006A completes the country experience on top of the existing TASK_004–006 catalog, profiles, editorial API, and admin foundation. It does not change the Prisma schema, migrations, database setup, authentication, upload/storage behavior, or unrelated product domains.

## Public experience

- `/countries` uses published API data for the destination cards, search suggestions, region filters, metrics, A–Z directory, and country links.
- Search supports URL state, submit, click selection, Escape, and arrow-key suggestion navigation without browser storage.
- `/countries/[slug]` uses the published country page endpoint and renders only published, API-backed sections, verified profile facts, FAQs, existing media, consultant cards, and SEO metadata.
- Detail jump navigation is generated from the sections returned by the API. Missing sections and unsupported facts are omitted.
- The page uses a shared header/footer and safe internal/HTTPS CTA fallback behavior; it does not invent mailto, lead, application, university, course, or subject workflows.

## Editorial contract

The approved section keys are:

`hero`, `why-study`, `universities`, `subjects`, `intakes`, `documents`, `cost-of-study`, `scholarships`, `visa-process`, `work-opportunities`, `language-requirements`, `events`, `cities`, `life-and-culture`, `living-costs`, `careers`, `application-steps`, `guides`, `faqs`, `consultant-cta`, and `trust-disclaimer`.

Body JSON remains bounded by section type. Rich text accepts paragraphs; fact/card/step sections accept constrained item shapes; CTA and media sections accept only their named text field. Unknown keys, markup, unsafe URLs, oversized collections, and unsafe item values are rejected by the API. Existing-media selection validates active, non-deleted image records; this task adds no upload or storage flow.

The protected admin country editor supports typed section creation/editing, ordering, status, media selection, FAQ lifecycle, full SEO metadata, consultant-card lifecycle, and optimistic stale-record conflicts. Stale saves are reported with a reload action rather than silently overwriting newer data.

## Validation performed

- Web production build
- Admin production build
- API production build
- API editorial policy unit tests
- Diff whitespace check

The remaining repository quality gates are run from the root validation sequence before commit/push. No Prisma schema or migration file is part of this task.
