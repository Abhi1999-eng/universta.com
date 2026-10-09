# Subject and university comparison ZIP alignment

Verified locally on 7 and 9 October 2026, before merge or deployment.

## Reference and scope

The owner approved aligning the country-subject template and university comparison with Mudit's `UNIVERSTA-COMPLETE-FINAL.zip` after seeing the reference screenshots. Source SHA-256: `edc31d411d523d6efd60e8cff9438bd981f060a2f9d88bdee53957bd91c17f1b`.

The closest subject reference is `dist/study-abroad/uk/social-sciences/index.html`, generated from `templates/course-listing.html`. The ZIP does not contain the current Arts, Humanities & Social Sciences taxonomy page. The university reference is `dist/compare/index.html`, generated from `templates/compare.html`; its university alias redirects there. Coventry is absent from the ZIP fixtures, so the reference screenshots use Manchester and Glasgow. The implementation uses the existing published UK catalogue.

## Result

- Country-subject pages use the reference's compact heading, matching fallback glyph, four measures, first six specialization chips and immediate course finder. Uploaded subject icons and descriptions take precedence. The full specialization directory, six study levels, course filters, save/compare actions, empty states and counselling links remain available.
- `/compare/universities` keeps its URL and noindex metadata while using the Study Abroad frame, reference hero, direct dropdown and horizontal comparison table. It accepts five published universities; the API limit is five for universities, four for courses and three for countries/consultants. Search-based staged selection and individual reading cards remain accessible in disclosures.
- The shared Study Abroad header uses the ZIP's five menu groups and responsive behavior. It retains the existing Phase 1 navigation, catalogue selector and assessment. The reference's effective desktop menu breakpoint is 1440px; 1080–1439px uses the drawer.
- Comparison picks update the shareable URL, preserve selection order and survive reload and Back/Forward. Controls disable during navigation. Regression tests cover rapid picks, intermediate server props and Back followed by a new selection.
- The comparison route reads unanswered fourth/fifth columns from older APIs during a rolling deployment. Campus counts and city lists omit explicitly inactive/deleted records.

The real UK flag, actual taxonomy names and recorded catalogue data are retained. Rankings display only when recorded. University-level tuition is not in the catalogue schema; the table links to actual programme fees instead. No ZIP sample rankings, fee estimates or profile scores are copied into the live data.

## Validation

- Final web suite: **117 files, 1,329 tests passed** (9 October).
- API suite: **124 suites, 989 tests passed** (7 October); comparison limit and ordering tests included.
- `npm run verify`: passed; existing lint warnings only. Web production build (`--webpack` for local dependency symlinks) and API build passed on 9 October.
- Browser comparison regression coverage extends the existing Phase 1 E2E suite; database/browser integration results are provided by PR CI.
- Manual built-in-pane checks at **1280 × 900** and **390 × 844**: subject heading, six hero links, all 60 Arts specialization links, all six levels and no page overflow. Computing and empty Agriculture cases were also checked on 7 October.
- Manual comparison using Coventry, King's College London, Edinburgh, Manchester and UCL: five columns, disabled sixth pick, reload, remove, Back/Forward, replacement with Birmingham and clear all passed. Phone viewport stayed 390px while the focusable comparison region contained a 1140px table.
- Header drawer, desktop keyboard navigation/Escape, country selector, assessment and subject search/IELTS filters checked on 7 October. No production data was changed for these design checks.

## Screenshots

Production before and local after use the same UK Arts page and Coventry comparison. Reference screenshots show the ZIP's own fixtures. Header interaction screenshots were captured on 7 October; final page screenshots on 9 October.

| Page | Production before | ZIP reference | Local after |
| --- | --- | --- | --- |
| UK subject, 1280 | [Before](live-uk-subject-1280.jpg) | [Reference](mudit-zip-uk-subject-1280.jpg) | [After](aligned-uk-subject-1280.jpg) |
| UK subject, 390 | [Before](live-uk-subject-390.jpg) | Same responsive template | [After](aligned-uk-subject-390.jpg) |
| University comparison, 1280 | [Before](live-university-compare-1280.jpg) | [Reference hero](mudit-zip-university-compare-two-1280.jpg) | [After](aligned-university-compare-1280.jpg) |
| University comparison, 390 | [Before](live-university-compare-390.jpg) | Same responsive template | [After](aligned-university-compare-390.jpg) |
| Comparison table | Previous three-item limit | [Reference table](mudit-zip-university-compare-table-1280.jpg) | [Five real UK universities](aligned-university-compare-five-table-1280.jpg) |

[Desktop menu at 1440](aligned-desktop-menu-1440.jpg) · [Mobile menu at 390](aligned-mobile-menu-390.jpg)

## Release check

Merge requires the owner's approval. After CI and approval, confirm the main deployment and lightly check the live subject page, five-university comparison, navigation and mobile overflow. This document records local acceptance; it does not claim these changes are deployed.
