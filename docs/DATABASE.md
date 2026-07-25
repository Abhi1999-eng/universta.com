# Database

The application database is native MySQL `universta`. `universta_shadow` is used only by Prisma during local migration development. Prisma owns all application tables and migration history.

## Tables by module

- Authentication and administration: `roles`, `users`, `user_roles`, `refresh_tokens`, `password_reset_tokens`, `login_attempts`, `audit_logs`.
- Media and global CMS: `media_assets`, `site_settings`, `feature_flags`, `pages`, `page_sections`, `navigation_menus`, `navigation_items`, `platform_metrics`, `seo_metadata`, `redirects`.
- Catalog masters: `continents`, `intakes`, `subjects`, `sub_subjects`, `course_levels`, `study_modes`.
- Countries: `countries`, `country_aliases`, `country_cost_profiles`, `country_work_profiles`, `country_language_requirements`, `country_intakes`, `country_statistics`, `country_content_sections`, `country_faqs`, `country_tags`, `country_tag_map`.
- Courses: `courses`, `course_study_modes`, `country_courses`, `country_course_intakes`, `course_content_sections`, `course_faqs`, `related_courses`.
- Consultants, leads, communication, and analytics: `consultant_landing_cards`, `leads`, `counselling_bookings`, `lead_notes`, `lead_status_history`, `email_templates`, `email_logs`, `search_logs`.
- Prisma-managed: `_prisma_migrations`.

The migration creates 49 application tables plus `_prisma_migrations`. TASK_005
uses the existing country profile tables and does not add a schema change or
migration.

## Relation overview

Users own roles, tokens, audit records, media uploads, content authorship, assignments, and lead notes. Countries belong to continents and own country-specific profiles, intake mappings, content, FAQs, tags, and course mappings. Courses belong to subjects and levels and connect to countries, intakes, study modes, FAQs, and related courses. Leads connect optional preferences to countries, courses, subjects, levels, and intakes and own bookings, notes, and status history.

All foreign keys are indexed. Many-to-many mappings use explicit models with compound unique constraints.

## Deletion and verification policy

- Published countries, subjects, and courses are soft-deleted or archived first through `deleted_at`/status fields.
- Permanent country deletion is restricted while active mappings exist.
- Subject deletion is restricted while courses exist.
- Media deletion is restricted by reference policy; media references use nullable relations where appropriate.
- Owned child records use explicit cascades only where the child has no independent lifecycle.
- Audit and history records are preserved.
- Country, course, work, language, cost, statistics, and metric records carry source and/or verification fields where specified. Unverified seed metrics remain placeholders.
- Structured country profile seed values are deterministic fictional local
  development data. Public profile claims require both `source_reference` and
  `verified_at`; missing or unverified optional facts are not exposed.

## Important indexes

The schema includes the blueprint's status/order, lookup, compound mapping, entity-history, assignment, and full-text indexes. The initial migration adds reviewed MySQL full-text indexes on country and course search fields. MySQL's 3072-byte UTF-8 index limit requires the `redirects.source_path` unique index to use a 750-character prefix while retaining the blueprint's `VARCHAR(1000)` column; this is documented in `docs/DECISIONS.md`.
