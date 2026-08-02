# Universta Phase 1 — Public Route Map

Where each admin module's records appear on the public site. Taken from the
live sitemap and confirmed by request against production.

Several routes are deliberately keyword-led rather than named after the admin
module, so the "obvious" URL is not always the real one. This caught out the
acceptance suite itself: a test pointed at `/consultants` and got a 404 while
the records were being served correctly from `/study-abroad-consultants`.

## Listing routes

| Admin module | Public listing | Status |
| --- | --- | --- |
| Countries | `/` (the homepage) | 200 |
| Subjects | `/subjects` | 200 |
| Universities | `/universities` | 200 |
| Courses | `/courses` | 200 |
| Scholarships | `/scholarships` | 200 |
| Consultants | `/study-abroad-consultants` | 200 |
| Jobs | `/careers` | 200 |
| Events | `/events` | 200 |
| Success stories | `/success-stories` | 200 |
| Testimonials | `/testimonials` | 200 |

## Detail routes

| Record | Pattern |
| --- | --- |
| Country | `/study-in-{slug}` |
| Subject | `/subjects/{slug}` |
| Subject specializations | `/subjects/{slug}/specializations` |
| University | `/universities/{slug}` |
| Course | `/courses/{slug}` |
| Scholarship | `/scholarships/{slug}` |
| Consultant | `/study-abroad-consultants/{slug}` |
| Job | `/careers/{slug}` |
| Event | `/events/{slug}` |

## Standalone pages

`/about`, `/contact`, `/faq`, `/counselling`.

## URLs that do not exist

These return 404. They are listed so they are not mistaken for outages, and so
the question of whether they *should* redirect can be decided deliberately.

| URL | Note |
| --- | --- |
| `/consultants` | The module is served from `/study-abroad-consultants`. |
| `/jobs` | The module is served from `/careers`. |
| `/compare` | Comparison is per-type; there is no combined entry point. |

`/countries` answers 308 and redirects, because the country listing became the
homepage.

**Recommendation.** `/consultants` and `/jobs` are the names a visitor or an
inbound link is most likely to guess, and the admin sidebar calls the modules
"Consultants" and "Jobs". Adding two redirects would cost nothing and close the
gap. The platform already has a Redirects admin screen for exactly this, so it
is a content change rather than a code one — left for the client to decide.
