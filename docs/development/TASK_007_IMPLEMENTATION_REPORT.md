# TASK_007 implementation report

TASK_007 provides the Subjects/Sub-Subjects, course master data, Courses API,
admin BFF/editorial workflows, and public subject/course discovery surfaces.
The UI parity phase is still in progress; it extends local deterministic
fixtures with the approved reference composition while preserving the
API-driven and factual-safety boundaries.

## Included

- Published subject listing, detail, and specialisation routes.
- URL-backed subject search and pagination.
- Subject cards, featured state, published directory, sticky detail navigation,
  published course-level snapshot, and specialisation/course links.
- Byte-identical approved HTML references in `design/reference/`.
- Reference inventory, parity harness, screenshot evidence, and parity documentation.

## Excluded

Subject/course comparison, matching, scholarships, rankings, salary claims,
university management, Docker, new migrations, and TASK_008 remain excluded.
Visual fixtures are test-only and guarded from production; the reference HTML
is not embedded or executed. Strict screenshot parity is not yet achieved.
