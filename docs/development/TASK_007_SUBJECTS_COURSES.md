# TASK_007 — Subjects and Courses

Status: implementation complete on `feat/task-007-subjects-courses`; merge is intentionally left to the repository owner.

## Scope delivered

- API modules for Subjects, Sub-Subjects, Course Levels, Study Modes, Courses, country mappings, intakes, controlled content sections, FAQs, related courses, and SEO metadata.
- Public read-only discovery at `/subjects`, `/subjects/:slug`, `/courses`, and `/courses/:slug`, including URL filters, keyboard-search suggestions, country selection, source references, JSON-LD, empty states, and no-arbitrary-country selection behavior.
- Same-origin Admin BFF routes with explicit method/path/query/body allowlists and safe error normalization.
- Super Admin catalog screens for Subjects, Sub-Subjects, Courses, Course Levels, and Study Modes with optimistic-version fields, dependency-aware deletion, audit-backed mutations, and accessible confirmation dialogs.
- Unit, admin component, and public browser coverage for catalog validation, empty states, filters, and responsive overflow.

## Deliberate exclusions

Course Comparison, counselling forms, university/provider catalogues, ranking/salary claims, authentication changes, Docker, new migrations, Prisma schema changes, TASK_008, and execution of the approved HTML references remain excluded. Approved UI references are preserved byte-for-byte as visual inputs and are not runtime assets.

## Data and publication rules

Public queries expose only published Subjects/Courses, active Course Levels/Study Modes, active published country mappings, and mappings with a source reference plus verification timestamp. Tuition filters require an explicit country. Publishing is blocked until core references, active study modes, and at least one verified country mapping are present. Admin writes use audit events and expected-update timestamps.

## Existing-schema compatibility note

The authoritative Prisma schema has no `sectionType` column on `CourseContentSection`, although the approved Phase 1 content contract requires that value. This task does not alter the schema or add a migration. The API stores the controlled section type alongside the body as `{ type, content }` in the existing `bodyJson` field and unwraps it at the public/admin response boundary. This preserves the schema freeze while keeping the contract explicit.

## Validation commands

Run from the repository root:

```bash
npm run db:format
npm run db:validate
npm run db:generate
npm run lint
npm run test
npm run build
```

The native MySQL database remains the only application database; this task does not use Docker or `prisma db push`.
