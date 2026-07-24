# Countries Listing data mapping

The approved HTML uses short JavaScript properties. The future API must return stable, typed DTOs with structured values; the frontend formats display strings. No hardcoded country records from the HTML may be copied into the application.

## Country card mapping

| HTML/source property | API DTO | Prisma model / SQL column | Data class and rule |
| --- | --- | --- | --- |
| `n` | `name` | `Country.name` → `countries.name` | Editorial/imported; searchable and alphabetically sortable |
| `fl` | `flag` `{url, alt}` | `Country.flagMediaId` → `media_assets.public_url`, `alt_text` | Imported/editorial media; hide if unavailable rather than emoji fallback in production |
| `r` | `continent` `{id,name,slug}` | `Country.continentId` → `continents` | Relational catalog data |
| `desc` | `shortDescription` | `Country.shortDescription` → `countries.short_description` | Editorial; published record only |
| `unis` | `universitiesCount` | `CountryStatistic.universitiesCount` → `country_statistics.universities_count` | Computed/displayed from structured count; source and verification required |
| `tuition` | `tuition {min,max,currencyCode,currencySymbol,period,notes}` | `CountryCostProfile` → `country_cost_profiles` | Structured money; frontend formats ranges and periods |
| `work` | `postStudyWork {available,minMonths,maxMonths,summary}` | `CountryWorkProfile` → `country_work_profiles` | Editorial/verified regulatory information; show disclaimer/source |
| `intake` | `majorIntakes[]` | `CountryIntake` + `Intake` → `country_intakes`, `intakes` | Relational; only available/approved major intake rows |
| `pr` | `pathwayBadge` | `CountryWorkProfile.immigrationPathwayStrength` → `country_work_profiles.immigration_pathway_strength` | Derived badge; must be qualified, sourced, and never an unconditional promise |
| `tags` | `filterFacets` | `CountryTagMap` + `CountryTag` → `country_tag_map`, `country_tags` | Managed taxonomy or derived filter behavior; no raw HTML tags |
| `progs` | `programCounts` | `CountryStatistic.ugCoursesCount`, `pgCoursesCount`, `pgdmCoursesCount`, `mbaCoursesCount` → `country_statistics` | Structured counts; computed/displayed and source-aware |
| `isFeatured` | `featured` | `Country.isFeatured` → `countries.is_featured` | Editorial flag |
| card order | `displayOrder` | `Country.displayOrder` → `countries.display_order` | Editorial ordering within status/region |
| `href="#"` | `detailUrl` | `Country.slug` → `countries.slug` | Computed route `/countries/:slug`; never a dead placeholder |

## Search, regions, filters, and directory

- Search `q` uses `countries.name`, `slug`, and approved aliases from `country_aliases.normalized_alias`; suggestions return `id`, name, slug, flag, continent, and university count.
- `continent` uses `countries.continent_id` joined to `continents.slug` or an approved API identifier.
- `budgetBand` uses `country_cost_profiles.budget_band`.
- `ieltsOptional` uses `country_language_requirements.ielts_requirement`; only controlled optional/not-required values qualify.
- `intake` uses `country_intakes.intake_id` joined to `intakes.slug`, with availability and major rules.
- `visaSuccessBand` uses `country_work_profiles.visa_success_band`, but only verified/source-backed values may be exposed.
- `pathwayStrength` uses `country_work_profiles.immigration_pathway_strength` with the approved disclaimer.
- `hasTopRankedUniversities` uses `country_statistics.top_ranked_universities_count > 0` and verification/source checks.
- `featured` uses `countries.is_featured`.
- `letter` is computed from the first character of `countries.name`; disabled letters have no published records.
- `sort` must be allowlisted (display order, name, popularity where approved); never pass raw SQL order input.
- `page` and `limit` are pagination controls with bounded limits.

Directory DTO fields:

| Directory field | Source |
| --- | --- |
| country name, slug | `countries.name`, `countries.slug` |
| flag | `countries.flag_media_id` → `media_assets` |
| short description | `countries.short_description` |
| UG/PG/PGDM/MBA counts | `country_statistics.ug_courses_count`, `pg_courses_count`, `pgdm_courses_count`, `mba_courses_count` |
| alphabetical first letter | computed from `countries.name` |
| display availability | `countries.status` published rule and `deleted_at IS NULL` |

## Platform metrics

The HTML metric labels map to `platform_metrics.metric_key`, `label`, `numeric_value`, `display_value`, `is_visible`, `display_order`, `source_reference`, and `verified_at`. Destinations, universities, courses, scholarships, visa success, and students guided must be managed values. If `is_visible=false`, the metric is omitted. Unverified values remain hidden or explicitly unverified according to the product decision.

## Consultant landing cards

The destination consultant cards map to `consultant_landing_cards`: optional `country_id`, `title`, `slug`, `short_description`, `overview`, `icon_media_id`, `featured_media_id`, `is_free_consultation`, `cta_label`, `cta_url`, `status`, `is_featured`, `display_order`, and `published_at`. Media URLs and alt text come through `media_assets`. Results are published, non-deleted records ordered by `display_order`.

## Editorial, computed, imported, and verified fields

- Editorial: headings, descriptions, featured flags, display order, labels, CTA copy, status, and taxonomy.
- Computed: formatted tuition strings, result counts, alphabet letters, badges, filter availability, and route URLs.
- Imported/curated: country names/codes, media, statistics, intake mappings, cost/work/language profiles, and official source references.
- Verification-required: visa success, immigration/pathway claims, costs, language requirements, work rights, statistics, scholarship counts, and ranking counts.
- Never hardcode: countries, metrics, university/course counts, tuition, visa success, work rights, intakes, flags, consultant cards, or A–Z program counts.

## Schema-gap review

No genuine Phase 1 schema gap was found for the approved Countries Listing fields. The existing schema covers all card, directory, filter, metrics, consultant, source, verification, status, soft-delete, and ordering needs. The only implementation caveats are policy rules: `ielts_requirement` and other status strings need application-level controlled vocabularies, and unsupported/unverified filters must be hidden or disabled. No schema change or migration is proposed in this planning task.
