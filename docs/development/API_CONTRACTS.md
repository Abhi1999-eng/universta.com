# API contract plan

Planning only. Endpoints are not implemented by this task.

## Public Countries Listing endpoints

| Method/path | Purpose | Query/params |
| --- | --- | --- |
| `GET /api/v1/continents` | Published region tabs and counts | optional `featured`/status policy |
| `GET /api/v1/platform-metrics` | Visible, source-aware platform metrics | none or approved group |
| `GET /api/v1/countries` | Paginated country cards | `q`, `continent`, `budgetBand`, `ieltsOptional`, `intake`, `visaSuccessBand`, `pathwayStrength`, `hasTopRankedUniversities`, `featured`, `letter`, `sort`, `page`, `limit` |
| `GET /api/v1/countries/suggestions` | Search autocomplete | `q`, bounded `limit` |
| `GET /api/v1/countries/directory` | A–Z directory DTOs | `letter`, `page`, `limit` |
| `GET /api/v1/countries/:slug` | Single country page data | `slug` path parameter |
| `GET /api/v1/consultant-landing-cards` | Published managed cards | optional `country`, `featured`, `page`, `limit` |

The route order must reserve `/suggestions` and `/directory` before the `/:slug` parameter route.

## Response envelopes

Collection response:

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 12, "total": 0, "totalPages": 0 },
  "error": null,
  "requestId": "request-id"
}
```

Single response:

```json
{
  "data": { "id": "uuid", "name": "Canada", "slug": "canada" },
  "meta": null,
  "error": null,
  "requestId": "request-id"
}
```

Error response:

```json
{
  "data": null,
  "meta": null,
  "error": { "code": "VALIDATION_ERROR", "message": "Invalid query", "details": [] },
  "requestId": "request-id"
}
```

## Structured country list DTO

```json
{
  "id": "uuid",
  "name": "Canada",
  "slug": "canada",
  "flag": { "url": "https://...", "alt": "Flag of Canada" },
  "continent": { "id": "uuid", "name": "North America", "slug": "north-america" },
  "shortDescription": "...",
  "statistics": { "universitiesCount": 0, "topRankedUniversitiesCount": 0 },
  "tuition": { "min": "18000.00", "max": "35000.00", "currencyCode": "CAD", "currencySymbol": "CA$", "period": "PER_YEAR" },
  "postStudyWork": { "available": false, "minMonths": null, "maxMonths": null, "summary": null },
  "majorIntakes": [],
  "pathway": { "strength": null, "label": null, "disclaimer": null, "verifiedAt": null },
  "featured": false,
  "displayOrder": 0
}
```

The API returns structured money/count/status fields. It must not persist or return display strings such as `£12–28k/yr` as the source of truth; formatting belongs to the frontend.

## Suggestions and directory DTOs

Suggestions return `id`, `name`, `slug`, `flag`, `continent`, and `universitiesCount`. Directory entries return `name`, `slug`, `flag`, `shortDescription`, `programCounts` (`ug`, `pg`, `pgdm`, `mba`), `letter`, and `isAvailable`.

## Admin contract plan

Future admin contracts cover CRUD and publish workflows for continents, countries and child profiles, subjects/sub-subjects, levels, study modes, courses and mappings, media, pages/sections/navigation, SEO/redirects, settings/flags, consultant landing cards, leads/bookings, email templates, users/roles, and audit reads. Every mutation needs DTO validation, permission checks, source/verification handling, soft-delete rules, and an audit event. No admin endpoint is implemented yet.
