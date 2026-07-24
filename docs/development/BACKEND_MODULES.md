# Backend module plan

Planning only. These modules are boundaries for the NestJS modular monolith; they are not separate services and are not implemented by this task.

| Module | Responsibility | Owned tables | Public endpoints | Admin endpoints | Validation/permissions/audit/dependencies |
| --- | --- | --- | --- | --- | --- |
| health | Process/database health | none | `GET /health` | none | Read-only; DB ping; structured health result; depends on Prisma |
| auth | Super Admin sign-in/session lifecycle | `refresh_tokens`, `password_reset_tokens`, `login_attempts` | Auth endpoints deferred to coding milestone | Admin auth endpoints | DTO validation, rate limits, role permission, login/token audit; users/roles |
| users | User profiles/status/soft deletion | `users`, `user_roles` ownership support | none in public Phase 1 | user/admin user endpoints | Email/phone validation, role guard, user audit; auth/roles/media |
| roles | System roles and assignment policy | `roles`, `user_roles` | none | role/assignment endpoints | Controlled role codes, Super Admin permission, assignment audit; users |
| audit | Immutable operational history | `audit_logs`, `lead_status_history` | none | filtered audit read | Request/user/entity context, append-only policy; all mutating modules |
| media | Upload metadata and reference safety | `media_assets` | approved public media reads later | media management | MIME/size/checksum validation, media permissions, upload/delete audit; users |
| settings | Site settings | `site_settings` | public settings allowlist later | settings CRUD | value type/JSON validation, public visibility policy, audit; users |
| feature-flags | Runtime feature switches | `feature_flags` | public flag allowlist later | flag CRUD | key/environment validation, Super Admin permission, audit |
| pages | CMS pages and sections | `pages`, `page_sections` | published page reads later | page/section CRUD | slug/status/publish validation, editor permission, content audit; media/users |
| navigation | Menus and menu tree | `navigation_menus`, `navigation_items` | published navigation later | menu/item CRUD | tree/ordering/link validation, editor permission, audit; pages/media |
| seo | Metadata and redirects | `seo_metadata`, `redirects` | metadata/redirect reads | SEO CRUD | canonical/robots/path validation, editor permission, audit; pages/countries/courses |
| continents | Region catalog | `continents` | `GET /api/v1/continents` | continent CRUD | slug/name/status validation, catalog permission, audit; media/users |
| countries | Country listing/detail/search data | country tables: `countries`, aliases, profiles, intakes, stats, sections, FAQs, tags/maps | `GET /api/v1/countries`, suggestions, directory, `/:slug` | country and child content CRUD | source/verification/status/soft-delete rules, catalog permission, audit; continents/media/intakes/courses |
| subjects | Subject catalog | `subjects`, `sub_subjects` | future subject reads | subject/sub-subject CRUD | slug/content validation, catalog permission, soft delete, audit; media/users |
| course-levels | Level catalog | `course_levels` | filter data later | level CRUD | code/order validation, catalog permission, audit |
| study-modes | Mode catalog | `study_modes` | filter data later | mode CRUD | code/order validation, catalog permission, audit |
| courses | Course catalog and country mappings | `courses`, study modes, country courses/intakes, content, FAQs, related | future course reads | course/mapping CRUD | slug/content/source/soft-delete rules, catalog permission, audit; subjects/levels/countries/media |
| leads | Lead intake and assignment | `leads`, `lead_notes`, `lead_status_history` | counselling lead submission later | lead/notes/status endpoints | consent, contact, status transitions, assignment permissions, audit; users/countries/courses |
| counselling | Booking lifecycle | `counselling_bookings` | booking request later | booking schedule/status endpoints | time zone/slot/status validation, assignment permissions, audit; leads/users |
| consultant-landing-cards | Managed destination landing cards | `consultant_landing_cards` | `GET /api/v1/consultant-landing-cards` | card CRUD | published/status/order validation, editor permission, audit; countries/media |
| email-templates | Controlled communications | `email_templates`, `email_logs` | none | template/log operations | template variables/sender validation, permission, delivery audit; leads/users |

## Cross-cutting rules

Use request IDs, structured logging, consistent exception envelopes, DTO validation, authorization guards, source/verification policy, pagination limits, and audit events for mutations. Feature modules remain inside one NestJS process and one Prisma client.
