# API contract plan

The standard response envelope and the catalog endpoints below are implemented
for TASK_004. Other endpoint families remain planning contracts.

## Public Countries Listing endpoints

| Method/path | Purpose | Query/params |
| --- | --- | --- |
| `GET /api/v1/continents` | Published region tabs and counts | optional `featured`/status policy |
| `GET /api/v1/platform-metrics` | Visible, source-aware platform metrics | none or approved group |
| `GET /api/v1/countries` | Paginated core country cards | `q`, `continent`, `featured`, `letter`, `sort`, `page`, `limit` |
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

TASK_004 returns only the core country fields and verified university count
available from the existing schema. Money, work, intake, pathway, language,
visa, and course profile fields remain deferred; the API does not accept those
filters or return display strings such as `£12–28k/yr` as a source of truth.

## Suggestions and directory DTOs

Suggestions return `id`, `name`, `slug`, `flag`, `continent`, and `universitiesCount`. Directory entries return `name`, `slug`, `flag`, `shortDescription`, `programCounts` (`ug`, `pg`, `pgdm`, `mba`), `letter`, and `isAvailable`.

## Admin catalog contracts

| Method/path | Purpose |
| --- | --- |
| `GET /api/v1/admin/continents` | Bounded Super Admin search/list with status and allowlisted sort |
| `POST /api/v1/admin/continents` | Create an active continent |
| `GET /api/v1/admin/continents/:id` | Read one non-deleted continent |
| `PATCH /api/v1/admin/continents/:id` | Update safe continent fields with optional `expectedUpdatedAt` |
| `DELETE /api/v1/admin/continents/:id` | Soft-delete an unused continent |
| `GET /api/v1/admin/countries` | Bounded Super Admin search/list with status, continent, and featured filters |
| `POST /api/v1/admin/countries` | Create a draft core country record |
| `GET /api/v1/admin/countries/:id` | Read one non-deleted core country |
| `PATCH /api/v1/admin/countries/:id` | Update safe core fields with optional `expectedUpdatedAt` |
| `POST /api/v1/admin/countries/:id/publish` | Validate readiness and publish |
| `POST /api/v1/admin/countries/:id/unpublish` | Return a published country to draft |
| `DELETE /api/v1/admin/countries/:id` | Soft-delete a country |

All catalog mutations require an active `SUPER_ADMIN`, use stable validation or
conflict codes, and append safe audit events. Client input cannot set actor,
audit, deletion, or publication fields. Detailed profile CRUD, Courses, Leads,
CMS, media uploads, SEO, and other future admin contracts remain deferred.
