# Countries Listing design analysis

Reference: `design/reference/final-countries-list.html` (byte-for-byte copy of the client-approved `Final countries List.html`). This document describes the approved design only; no page implementation has been started.

## A. Design system

### Tokens

| Category | Approved values |
| --- | --- |
| Primary brand | `#1657CF`; dark `#0F3FA0`; light-on-dark `#A8C7FF`; tints `#EFF4FE`, `#D8E5FB` |
| Text | Heading `#0D1524`; body `#48505F`; muted `#828B9B` |
| Secondary/accent | Warm accent `#D9622B`; accent tint `#FDF2EC`; info equals brand |
| Backgrounds | Canvas `#FAFBFD`; surface `#FFFFFF`; soft band `#F1F4F9` |
| Borders | Primary line `#E5EAF2`; stronger line `#D2DAE6` |
| Shadows | Small `0 1px 2px rgba(13,21,36,.04), 0 1px 3px rgba(13,21,36,.05)`; medium `0 2px 4px rgba(13,21,36,.03), 0 8px 24px rgba(13,21,36,.06)`; large `0 4px 8px rgba(13,21,36,.04), 0 16px 48px rgba(13,21,36,.09)` |
| Radii | Small 12px, medium 16px, large 24px, extra-large 32px, pills 999px |
| Spacing | 8, 16, 24, 32, 40, 56, 80, 112px |
| Motion | `cubic-bezier(.22,.61,.36,1)`; most hover transitions 0.18–0.30s; reveal 0.6s |
| Typography | Plus Jakarta Sans for headings/brand/display numbers; Inter for body and controls; system fallbacks are present in the source |
| Weights | Headings 700/800; body 400–500; labels and buttons 500–600; display metrics 800 |
| Layout | 1200px content wrapper with 24px desktop padding and 18px mobile padding |

The source includes Google Fonts `<link>` tags. The future Next.js implementation must use `next/font/google` for Plus Jakarta Sans and Inter instead of copying those tags.

### Responsive breakpoints

- Desktop: above 1024px; three-column country/A–Z/consultant grids, six metrics, full navigation.
- Tablet: `max-width: 1024px`; two-column cards, three metrics, desktop nav hidden, menu button shown, CTA artwork hidden.
- Mobile: `max-width: 640px`; one-column cards, two metrics, stacked search, single-column fact/CTA blocks, horizontally scrollable region tabs, stacked/full-width CTA controls.
- The mobile tabbar uses `top: 70px`; the desktop sticky tabbar uses `top: 76px`.
- Reduced motion: `prefers-reduced-motion: reduce` disables transitions/animations and makes reveal elements visible immediately.

## B. Page sections in approved order

1. Sticky Global Header
2. Hero badge
3. Hero heading and description
4. Comparison-information chips
5. Country search and suggestions
6. Quick filter chips
7. Platform metrics
8. Browse by Region introduction
9. Sticky region tabs
10. Results count
11. Country card grid
12. Counselling CTA banner
13. A–Z country directory
14. Account/journey CTA
15. Consultant landing cards
16. Final personalised-shortlist CTA
17. Trust indicators
18. Footer disclaimer

## C. Approved interactions

- Header adds its bottom border after scrolling more than 10px.
- Region tabs become border-highlighted when their sticky top reaches the header.
- Country search filters by country name, shows up to five suggestions, and scrolls to regions after Search or Enter.
- Suggestion selection sets the query and returns to All destinations.
- Suggestions close on outside click and after selection.
- Quick filters are multi-select toggle chips; active chips are blue and all selected filters are ANDed.
- Quick filter activation scrolls smoothly to the regions/results section.
- Region tabs update the active state, count, and card list.
- Results show a count or an empty state with Clear all.
- Clear all resets filters, region, query, input, chip states, and tabs.
- A–Z letters are disabled when no source country begins with that letter; active letter filters the directory.
- Cards, stats, CTAs, and consultant cards lift on hover; card arrows translate horizontally.
- Reveal-on-scroll uses `IntersectionObserver` at threshold `.12`, adds `.in`, and staggers delays by four-item cycles at 60ms.
- Reduced-motion users receive no reveal/transition animation.
- The source includes a mobile menu button visually, but no menu interaction handler; this is a design-to-implementation gap to resolve later.

## D. Quick filters and data rules

| Label | HTML key | API parameter | Database source/rule | Verification and unavailable behavior |
| --- | --- | --- | --- | --- |
| Budget friendly | `budget` | `budgetBand` | `country_cost_profiles.budget_band`; match the approved budget taxonomy | Hide/disable until editorial cost data is present and sourced |
| IELTS optional | `ielts` | `ieltsOptional` | `country_language_requirements.ielts_requirement`; only a controlled optional/not-required value qualifies | Hide/disable when language requirement is `VARIES` or unverified |
| January intake | `jan` | `intake` | `country_intakes` → `intakes`, matching January and available/major records | Disable when no verified January mapping exists |
| High visa success | `visa` | `visaSuccessBand` | `country_work_profiles.visa_success_band` | Hidden/disabled unless a verified source and `verified_at` exist; never infer from sample HTML |
| PR friendly | `pr` | `pathwayStrength` | `country_work_profiles.immigration_pathway_strength` and approved summary/disclaimer | Use qualified pathway information and disclaimers; never promise immigration outcomes |
| Top ranked universities | `rank` | `hasTopRankedUniversities` | `country_statistics.top_ranked_universities_count > 0` with source/verification | Hide/disable when the statistic is missing or unverified |

The API should support multiple simultaneous parameters. Backend rules must apply verified, non-deleted records only. If a filter cannot be supported by verified data, the UI should not show an authoritative-looking active state.

## E. Country card API fields

Each card needs: `id`, `name`, `slug`, `flag`, `continent`, `shortDescription`, university count, tuition minimum/maximum, currency symbol/code, tuition period, post-study work summary, major intakes, immigration/pathway badge, featured status, and display order. The precise database mapping is maintained in `COUNTRIES_DATA_MAPPING.md`.

## F. A–Z directory

The directory needs country name, slug, flag, short description, UG count, PG count, PGDM count, MBA count, computed alphabetical first letter, and display availability. The letter is derived from `countries.name`; availability is derived from published status and `deleted_at`. The HTML's JavaScript `D` array must not be copied into Next.js.

## G. Platform metrics

The HTML displays destinations, universities, courses, scholarships, visa success, and students guided. These must be returned by `platform_metrics`, with `is_visible`, source/reference, and verification applied. Sample values from the HTML are not verified facts and must never be seeded or published as such.

## H. Consultant cards

The destination cards are managed landing cards, not consultant accounts. Phase 1 uses `consultant_landing_cards` with optional country, title, slug, short description, overview, media, free-consultation flag, CTA, status, featured flag, publish date, and display order. No consultant login, account, dashboard, or matching engine is implied.

## I. Deferred/feature-controlled controls

Sign in, Create free account, Save universities, Compare countries, Track applications, Find My Best Match, and personalized matching are deferred or feature-controlled. Current flags remain `PUBLIC_LOGIN=false`, `STUDENT_ACCOUNT=false`, `COMPARE_COUNTRIES=false`, and `MATCHING_TOOL=false`. Find My Best Match may route to counselling. Create free account should be hidden or replaced by an approved counselling CTA. No dead `href="#"` action should remain in production.

## J. Accessibility requirements

Use semantic headings, real buttons and links, visible `:focus-visible` styles, keyboard-accessible suggestions, `role="listbox"`/`role="option"` autocomplete semantics, Escape dismissal, `aria-expanded`/`aria-controls`, accessible mobile-menu state, sufficient contrast, reduced-motion support, meaningful image alt text, an announced result count, and no clickable `div` elements. The current HTML has an input label but lacks full autocomplete/menu semantics and visible focus styling, so these are implementation acceptance requirements.

## K. Responsive behavior

Desktop is a wide information-dense layout: three-column cards, six metrics, full nav, three-column A–Z, and three-column consultants. Tablet reduces cards to two columns and metrics to three, hides desktop nav, shows the burger, and removes CTA artwork. Mobile uses one-column cards and fact blocks, two metrics, stacked search and CTA lists, horizontally scrollable region tabs, and full-width/stacked CTA controls.

## Source data and implementation boundary

The HTML contains 12 hardcoded country records, a hardcoded consultant description/order map, inline SVG icons, six sample metrics, and `#` placeholders. These are visual reference inputs only. The future implementation must fetch structured API data, format display strings in the frontend, show source/verification-aware content, and retain the approved layout/interaction intent without blindly copying the source JavaScript.
