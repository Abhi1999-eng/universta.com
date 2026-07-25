# TASK_007 implementation report

TASK_007 provides the Subjects/Sub-Subjects, course master data, Courses API,
admin BFF/editorial workflows, and public subject/course discovery surfaces.
The UI parity phase extends the existing public catalog with approved subject
reference mappings while preserving the API-driven and factual-safety
boundaries.

## Included

- Published subject listing, detail, and specialisation routes.
- URL-backed subject search and pagination.
- Subject cards, featured state, published directory, sticky detail navigation,
  published course-level snapshot, and specialisation/course links.
- Byte-identical approved HTML references in `design/reference/`.
- Reference inventory and parity documentation.

## Excluded

Subject/course comparison, matching, scholarships, rankings, salary claims,
university management, fake sample fixtures, Docker, new migrations, and
TASK_008 remain excluded. The reference HTML is not embedded or executed.
