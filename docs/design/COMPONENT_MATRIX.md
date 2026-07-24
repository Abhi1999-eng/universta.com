# Countries Listing component matrix

These are planned components only. No component implementation is created by this planning task.

| Component | Responsibility | Server/client | Props/data | Interaction, states, accessibility, tests | Intended location |
| --- | --- | --- | --- | --- | --- |
| `GlobalHeader` | Sticky brand/navigation/header CTAs | Client shell over server markup | nav items, CTA links, feature flags | Scroll border, focus, responsive menu trigger; test scroll/menu/keyboard | `apps/web/src/features/countries/GlobalHeader.tsx` |
| `MobileNavigation` | Mobile navigation drawer/menu | Client | items, open, onClose | Escape, focus trap/return, `aria-expanded`, route links; test open/close/focus | `apps/web/src/features/countries/MobileNavigation.tsx` |
| `HeroSection` | Hero copy, badge, comparison chips, search/filter entry | Server composition | content, metrics, children | Loading/error for data-backed badge/metrics; heading hierarchy and contrast | `apps/web/src/features/countries/HeroSection.tsx` |
| `HeroBadge` | Small destination/university summary | Server | destination count, university count, verification state | Hide unverified values; test formatted counts and fallback | `apps/web/src/features/countries/HeroBadge.tsx` |
| `ComparisonInfoChips` | Displays comparison dimensions | Server | chip definitions | Informational only; test order and accessible labels | `apps/web/src/features/countries/ComparisonInfoChips.tsx` |
| `CountrySearch` | Search input and submit behavior | Client | initial query, onQuery, onSubmit | Enter, submit, loading, error; real label, focus, autocomplete wiring; test debounce/submit | `apps/web/src/features/countries/CountrySearch.tsx` |
| `SearchSuggestions` | Country suggestion listbox | Client | suggestions, active index, onSelect, open | Arrow keys, Enter, Escape, outside click, option semantics; test keyboard/no-results | `apps/web/src/features/countries/SearchSuggestions.tsx` |
| `QuickFilterChips` | Multi-select filters | Client | filter definitions, selected, onChange, availability | Active/disabled/loading states; buttons, labels, multi-filter tests | `apps/web/src/features/countries/QuickFilterChips.tsx` |
| `PlatformMetrics` | Verified visible metrics grid | Server | metrics | Loading, unavailable/hide, source policy; test hidden metrics and order | `apps/web/src/features/countries/PlatformMetrics.tsx` |
| `RegionTabs` | Sticky region selector | Client | regions, selected, counts, onChange | Horizontal scroll, keyboard tabs, active/loading state; test count/filter | `apps/web/src/features/countries/RegionTabs.tsx` |
| `ResultsSummary` | Results count and active context | Client | count, query, region, filters | Screen-reader announcement; test singular/plural/empty | `apps/web/src/features/countries/ResultsSummary.tsx` |
| `CountryGrid` | Grid composition and async boundary | Server + client controller | countries, pagination, card render | Loading skeleton, empty/error, responsive columns; test rendering and retry | `apps/web/src/features/countries/CountryGrid.tsx` |
| `CountryCard` | Country summary and facts | Server | country card DTO | Hover/focus, verified badges, real detail link; test all fields/fallbacks | `apps/web/src/features/countries/CountryCard.tsx` |
| `CountryFacts` | Tuition/work/intake fact block | Server | structured cost/work/intakes | No fabricated values; test formatting and unavailable values | `apps/web/src/features/countries/CountryFacts.tsx` |
| `EmptyCountriesState` | No-match recovery | Client | clear handler, context | Focusable Clear all button and announced state; test reset | `apps/web/src/features/countries/EmptyCountriesState.tsx` |
| `CounsellingBanner` | First counselling CTA band | Server | copy, benefits, CTA links | Approved destinations only; loading/error not needed for static copy; link tests | `apps/web/src/features/countries/CounsellingBanner.tsx` |
| `AlphabetFilter` | A–Z directory filter | Client | letters, selected, availability, onChange | Disabled letters, keyboard focus; test available/disabled letters | `apps/web/src/features/countries/AlphabetFilter.tsx` |
| `CountryDirectory` | A–Z country collection | Server + client filter | directory entries, selected letter | Loading/empty/error, semantic list; test sort and letter filter | `apps/web/src/features/countries/CountryDirectory.tsx` |
| `CountryDirectoryCard` | Compact directory tile | Server | directory DTO | Real slug link, alt text, program count fallback; test fields | `apps/web/src/features/countries/CountryDirectoryCard.tsx` |
| `JourneyCTA` | Account/journey CTA | Server | feature flags, counselling link | Hide disabled account actions; test flag behavior/no dead links | `apps/web/src/features/countries/JourneyCTA.tsx` |
| `ConsultantGrid` | Managed landing-card grid | Server | consultant cards | Loading/empty/error, order; test published/featured order | `apps/web/src/features/countries/ConsultantGrid.tsx` |
| `ConsultantCard` | Destination consultant landing card | Server | landing-card DTO | Real CTA, free-consultation label only when true; test source data | `apps/web/src/features/countries/ConsultantCard.tsx` |
| `FinalCTA` | Personalized-shortlist/counselling CTA | Server | feature flags, counselling link | Match feature hidden or counselling redirect; test no dead links | `apps/web/src/features/countries/FinalCTA.tsx` |
| `TrustIndicators` | Verified/static trust-supporting copy | Server | approved indicators | No unsupported claims; test visible approved copy only | `apps/web/src/features/countries/TrustIndicators.tsx` |
| `GlobalFooter` | Disclaimer and global footer | Server | disclaimer, links | Semantic footer, source disclaimer; test rendering and links | `apps/web/src/features/countries/GlobalFooter.tsx` |

## Generic package primitives

Only genuinely reusable primitives should enter `packages/ui`: `Button`, `Container`, `Badge`, `Input`, `Card`, `Skeleton`, and `EmptyState`. Countries-specific components stay under `apps/web/src/features/countries/`; the page should not be decomposed into a generic UI package merely for convenience.
