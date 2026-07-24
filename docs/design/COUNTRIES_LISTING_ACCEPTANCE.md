# Countries Listing acceptance criteria

These criteria apply to the future implementation and are not being executed in this planning task.

## Visual fidelity

- Match the approved section order and overall composition from `design/reference/final-countries-list.html`.
- Use the documented brand palette, borders, shadows, radii, spacing scale, Plus Jakarta Sans headings, and Inter body typography.
- Keep the 1200px content wrapper, sticky header, sticky region tabs, pill controls, card/CTA patterns, and inline SVG/icon treatment consistent with the reference.
- Use `next/font/google`; do not copy the source Google Fonts links.
- No hardcoded country/metric/consultant data appears in the rendered application code.

## Responsive screenshots and layout

Later visual QA must capture 1440px, 1024px, 768px, and 390px viewports.

- At 1440px: full navigation, three-column country/A–Z/consultant grids, six metric columns.
- At 1024px: two-column cards, three metric columns, hidden desktop nav, visible mobile trigger, no CTA artwork.
- At 768px: tablet behavior remains usable with two-column cards where space permits and no horizontal page overflow.
- At 390px: one-column cards/facts/CTAs, two metrics, stacked search, horizontally scrollable region tabs, visible focus and usable tap targets.

## Search, filters, regions, and directory

- Search suggestions are API-backed, keyboard accessible, capped at five suggestions, and close on outside click/Escape.
- Enter and Search submit the same query; result count and cards update; no-result state offers a working Clear all button.
- Quick filters support simultaneous AND behavior and show only when backed by verified/available data.
- Region tabs update active state, count, result set, keyboard semantics, and sticky behavior.
- A–Z letters are API-derived; unavailable letters are disabled; selection updates the directory without copying the HTML `D` array.
- Results loading, empty, error, and retry states are explicit and screen-reader understandable.

## Data integrity and claims

- Country cards render structured cost, work, intake, statistics, pathway, and media fields from APIs.
- Tuition, counts, visa/work/language/ranking claims show approved source/verification handling and never invent fallback facts.
- “High visa success” is hidden/disabled without verified data. “PR friendly” is qualified with approved disclaimers.
- Platform metrics respect `is_visible` and verification/source policy.
- Consultant cards come from published `consultant_landing_cards` ordered by `display_order`.

## CTA behavior and SEO

- Every enabled CTA is a real route or form action; no production `href="#"` dead links remain.
- Account, compare, save, track, and matching controls respect feature flags; disabled features are hidden or replaced with approved counselling paths.
- Country detail links use slug routes. The page renders server-readable headings, metadata, canonical URL strategy, and a meaningful empty/error response.

## Accessibility and motion

- Semantic headings follow one `h1` and logical `h2`/`h3` order.
- Search uses label, `role="combobox"`, `aria-expanded`, `aria-controls`, listbox/options, active-descendant or equivalent keyboard state, and Escape dismissal.
- Region tabs and A–Z controls are keyboard-operable with visible focus.
- Mobile navigation exposes expanded state, has focus management, and closes with Escape.
- Images have meaningful alt text; decorative icons are hidden from assistive technology.
- Result changes are announced without trapping focus.
- Contrast meets the project accessibility target; reduced-motion users receive no required animation.

## Quality gates

- Unit/component tests cover filters, search, suggestions, empty/error states, feature flags, formatting, and keyboard behavior.
- API contract tests cover query validation, pagination, verification rules, and response envelopes.
- Visual review compares the four required viewport screenshots to the approved HTML reference.
- No unsupported claim, dead button, hardcoded country record, or unverified metric is accepted.
