# Phase 1 Inventory — discovered from the implemented system

Discovered by enumerating the codebase and probing the live deployment, not
from prior documentation. Baseline commit: `508e32a`.

## Totals

| Surface | Count | Source of truth |
| --- | ---: | --- |
| Public routes (`page.tsx` under `apps/web/src/app`) | 40 | filesystem |
| Admin route files (`page.tsx` under `apps/admin/src/app`) | 32 | filesystem |
| Admin navigation leaves | 40 | `apps/admin/src/features/shell/nav-config.ts` |
| API controllers (`@Controller`) | 49 | `apps/api/src` |
| Prisma models | 82 | `apps/api/prisma/schema.prisma` |

Admin nav leaves (40) exceed admin route files (32) because several screens are
query-scoped variants of one file — `/settings?section=…` (7 leaves, 1 file),
`/catalog-masters?section=…` (4 leaves), `/locations?tab=…` (2 leaves) — and
because `/phase1/[resource]` is one file serving 11 resources.

## Public routes (40)

Static: `/`, `/about`, `/careers`, `/cities`, `/contact`, `/counselling`,
`/countries`(→308), `/courses`, `/events`, `/faq`, `/preview`, `/scholarships`,
`/study-abroad-consultants`, `/subjects`, `/success-stories`, `/testimonials`,
`/universities`

Comparison: `/compare/countries`, `/compare/universities`, `/compare/courses`,
`/compare/consultants`

Dynamic: `/careers/[slug]`, `/countries/[slug]`(→308), `/courses/[slug]`,
`/courses/[slug]/[specializationSlug]` (+`/[countrySlug]`, +`/[intakeSlug]`),
`/events/[slug]`, `/scholarships/[slug]`,
`/study-abroad-consultants/[slug]`,
`/study-abroad-consultants/locations/[locationSlug]`,
`/study-in/[countrySlug]` (+`/[citySlug]`, +`/cities`),
`/subjects/[slug]` (+`/specializations`),
`/universities/[slug]` (+`/claim`, `/courses`, `/courses/[offeringSlug]`)

Generated: `/sitemap.xml`, `/robots.txt`

### Public URL rewrites

`next.config.ts` rewrites the visitor-facing `study-in-{country}` form onto the
internal `study-in/{country}` segment. Both forms serve 200; the canonical
always points at the hyphenated public form. This is by design, not a defect.

## Admin navigation (40 leaves in 11 groups)

| Group | Leaves |
| --- | --- |
| Website Builder | Website Pages, Global Header, Global Footer, Navigation menus, Page templates, Media library, SEO management |
| Content records | Pages, Success stories, Testimonials |
| Destinations | Continents, Countries, States / provinces, Cities |
| Academics | Subjects, Generic courses, Course levels, Study modes, Intakes |
| Universities | Universities, University course offerings, University claim requests |
| Scholarships | Scholarships, Scholarship providers |
| Consultants | Consultants, Consultant locations |
| Enquiries | Contact enquiries, Counselling leads |
| Careers & events | Jobs, Events |
| Operations | Bulk import / export, Redirects, A/B experiments |
| Settings | General, Branding, Contact details, Social links, Header, Footer, Default SEO |

`/phase1/[resource]` serves: universities, scholarships, consultants, jobs,
events, success-stories, testimonials, offerings, pages, navigation-menus,
contact-inquiries.

## Production content inventory (live, at time of audit)

| Resource | Published rows |
| --- | ---: |
| countries | 13 |
| courses | 12 |
| subjects | 5 |
| universities | **0** |
| scholarships | **0** |
| consultants | **0** |
| jobs | **0** |
| events | **0** |
| success-stories | **0** |
| testimonials | **0** |

Seven of the ten content modules hold no production data. Their listing pages
render a valid empty state and return 200, but no detail route for them can be
exercised, and the client cannot demonstrate them. Recorded as **ISS-001**.
