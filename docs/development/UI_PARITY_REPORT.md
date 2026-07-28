# UI parity report

## Scope

Pixel-parity work is in progress on `feat/task-007-subjects-courses`. The six
approved references are preserved byte-for-byte in `design/reference/` and are
served only by the local comparison harness. Reference HTML and JavaScript are
not loaded by the application.

## Reference coverage

| Route | Reference | Fixture status |
| --- | --- | --- |
| `/countries` | `final-countries-list.html` | Structured local fixture; strict diff failing |
| `/countries/canada` | `final-country-detail.html` | Structured local fixture; strict diff failing |
| `/subjects` | `subjects-listing.html` | Structured local fixture; strict diff failing |
| `/subjects/computer-science` | `subject-detail.html` | Structured local fixture; strict diff failing |
| `/subjects/computer-science/specializations` | `subject-specializations.html` | Structured local fixture; strict diff failing |
| `/courses` | `courses-listing.html` | Structured local fixture; strict diff failing |

No uploaded homepage or course-detail reference exists, so those routes are
not included in the parity matrix.

## Harness and evidence

The deterministic fixture mode is enabled only when
`VISUAL_FIXTURE_MODE=true` and `NODE_ENV !== production`. The Playwright
matrix uses Chromium at 1440×1000, 768×1024, and 390×844, and writes full-page
and selected-section evidence to:

`apps/admin/test-results/ui-parity/{route}/{viewport}/`

Each case records `reference.png`, `actual.png`, `diff.png`, `overlay.png`,
section equivalents, and `metrics.json`. Full-page acceptance is strict at
`<= 0.001`; section acceptance is strict at `<= 0.0005` with matching image
dimensions.

The latest complete matrix generated screenshots and metrics for all 18
route/viewport cases. All 18 cases failed the strict gate:

| Route | Desktop | Tablet | Mobile |
| --- | ---: | ---: | ---: |
| Countries Listing | 0.098934 (1440×7331 vs 1440×7149) | 0.078571 (834×8891 vs 834×8825) | 0.203184 (645×15841 vs 645×14167) |
| Country Detail | 0.492456 (1440×16066 vs 1440×9127) | 0.507503 (834×21866 vs 834×12056) | 0.562199 (645×31316 vs 645×14775) |
| Subjects Listing | 0.218818 (1440×12687 vs 1440×10370) | 0.252215 (768×15982 vs 768×12747) | 0.276926 (416×24042 vs 416×18821) |
| Subject Detail | 0.227911 (1440×13167 vs 1440×10622) | 0.271087 (768×18122 vs 768×14520) | 0.299448 (416×25422 vs 416×18953) |
| Subject Specializations | 0.036502 (1440×9567 vs 1440×9640) | 0.082870 (768×11986 vs 768×12197) | 0.083795 (416×17819 vs 416×17948) |
| Courses Listing | 0.251641 (1440×10157 vs 1440×12857) | 0.334543 (768×12151 vs 789×16663) | 0.409959 (416×15190 vs 416×23967) |

The strict full-page limit is 0.001 and the selected-section limit is
0.0005. The country detail and courses listing remain materially different in
section structure and height; country listing/detail also have responsive
section-width mismatches at tablet/mobile.

Pixel parity is therefore not claimed, the CI parity job is expected to fail,
and no commit/push or PR readiness action was performed. The existing browser
E2E suite could not be rerun in this environment because
`E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` are not available; this is separate
from the passing unit, lint, and production-build checks.

## Safety boundaries

- Production routes remain API-driven when `VISUAL_FIXTURE_MODE` is unset.
- No Prisma schema or migration files were changed.
- No reference HTML or reference asset was modified.
- No Docker files, credentials, real `.env` files, or token persistence were added.
- Sample counts, rankings, salary claims, scholarship claims, and testimonials
  in the references remain isolated to local visual fixtures.
