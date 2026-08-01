# Phase 1 Test Coverage Matrix

Baseline `508e32a`. Every row was executed against the **live production
deployment**, not a local build.

## C5-A — Public route sweep (72 executed checks)

24 routes × 3 viewports (desktop 1536×900, tablet 768×1024, mobile 390×844).
Each check asserts: HTTP < 400, exactly one `<h1>`, no horizontal overflow,
zero browser console errors; and records canonical + meta description.

**Result: 69 passed, 3 failed.** All 3 failures are ISS-002 on the same route.

| # | Route | Desktop | Tablet | Mobile | Canonical | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| P-01 | `/` | PASS | PASS | PASS | `/` | H1 "Where will your degree take you?" |
| P-02 | `/about` | PASS | PASS | PASS | `/about` | |
| P-03 | `/careers` | PASS | PASS | PASS | `/careers` | empty state (ISS-001) |
| P-04 | `/cities` | PASS | PASS | PASS | `/cities` | |
| P-05 | `/compare/consultants` | PASS | PASS | PASS | ✓ | empty (ISS-001) |
| P-06 | `/compare/countries` | PASS | PASS | PASS | ✓ | |
| P-07 | `/compare/courses` | PASS | PASS | PASS | ✓ | |
| P-08 | `/compare/universities` | PASS | PASS | PASS | ✓ | empty (ISS-001) |
| P-09 | `/contact` | PASS | PASS | PASS | `/contact` | |
| P-10 | `/counselling` | PASS | PASS | PASS | `/counselling` | ISS-003 in context chip |
| P-11 | `/courses` | PASS | PASS | PASS | `/courses` | ISS-006 in H1 |
| P-12 | `/events` | PASS | PASS | PASS | `/events` | empty (ISS-001) |
| P-13 | `/faq` | PASS | PASS | PASS | `/faq` | |
| P-14 | `/scholarships` | PASS | PASS | PASS | `/scholarships` | empty (ISS-001) |
| P-15 | `/study-abroad-consultants` | PASS | PASS | PASS | ✓ | empty (ISS-001) |
| P-16 | `/subjects` | PASS | PASS | PASS | `/subjects` | |
| P-17 | `/success-stories` | PASS | PASS | PASS | ✓ | empty (ISS-001) |
| P-18 | `/testimonials` | PASS | PASS | PASS | ✓ | empty (ISS-001) |
| P-19 | `/universities` | PASS | PASS | PASS | ✓ | empty (ISS-001) |
| P-20 | `/study-in-canada` | **FAIL** | **FAIL** | **FAIL** | ✓ | **ISS-002** hydration #418; ISS-004 in description |
| P-21 | `/study-in-canada/cities` | PASS | PASS | PASS | ✓ | ISS-003 in title |
| P-22 | `/courses/diploma-cybersecurity` | PASS | PASS | PASS | ✓ | ISS-004 in description |
| P-23 | `/subjects/computer-science` | PASS | PASS | PASS | ✓ | |
| P-24 | `/subjects/computer-science/specializations` | PASS | PASS | PASS | **null** | **ISS-005**; ISS-006 in H1 |

## C5-B — HTTP status and title sweep (29 routes)

All returned the expected status. `/countries` → 308 → `/`, and
`/countries/{slug}` → 308 → `/study-in-{slug}`; both are by design.
`/sitemap.xml` and `/robots.txt` both 200.

## Regression — previously deployed fixes re-verified

| ID | Check | Result |
| --- | --- | --- |
| R-01 | Resources dropdown: real mouse click opens and stays open | PASS (live) |
| R-02 | Resources dropdown: Escape closes, focus returns to trigger | PASS (live) |
| R-03 | Resources dropdown: outside click closes | PASS (live) |
| R-04 | Resources dropdown: keyboard Tab → Enter → Tab into links | PASS (live) |
| R-05 | Resources dropdown: touch tap toggles | PASS (live) |
| R-06 | Header renders ≥1 nav item on every audited route | PASS (72/72) |
| R-07 | `/` serves the Countries listing | PASS |
| R-08 | `/countries` → 308 → `/` preserving query | PASS |

## Unit / build gates

| Gate | Result |
| --- | --- |
| `apps/web` vitest | 27/27 pass (10 files) |
| `apps/web` tsc --noEmit | clean |
| `apps/web` next build | clean |
| `apps/api` jest (settings) | 15/15 pass |
| `apps/api` nest build | clean |

## Not yet executed

Admin-side coverage (C3 media / bulk / scheduling / internal linking, all admin
routes, every field, admin-to-frontend mapping) and the comparison lifecycle
(C4) have **not** been run. No rows are claimed for them.
