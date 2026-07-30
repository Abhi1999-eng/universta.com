# Phase 1 UI fidelity matrix

Source references: `.local-ui-reference/General/*.png` (18 files, gitignored,
not committed). All 18 images are 1536×1024 PNGs from the same AI design-tool
export batch.

## Reference-set integrity notes (read first)

- **`Home.png` includes a non-UI "DESIGN BRIEF FOR CLAUDE" side panel**
  (goal/requirements/color palette/typography/reference brands) baked into
  the right ~370px of the image. That panel is not part of the page design
  and is excluded from parity comparison; only the left ~1160px is the
  actual homepage mockup.
- **Every mockup contains fabricated statistics, real third-party logos, and
  fake review content** that must never be reproduced: "50,000+
  Universities", "2,50,000+ Courses", "98% Visa Success Rate", "4.8/5 (12K+
  Reviews)", real institution logos (MIT, University of Melbourne, Sydney,
  UCL, McGill), specific QS/THE/US News/ARWU ranking numbers for named real
  universities, invented career-salary ranges, and an invented student
  testimonial ("Priya Sharma"). None of this is copied anywhere in this
  implementation. Where the same *structural slot* exists (e.g. a stat
  strip, an accreditation list, a testimonial card), it is filled with real
  database-backed values or an honest empty state instead, per the
  brief's own data-safety rule.
- **`Book Free Counselling.png` is itself an Exams/IELTS-coaching mockup**
  (breadcrumb: `Home > Exams > IELTS Coaching > Book Free Counselling`;
  copy: "IELTS Coaching", "Target IELTS Score", "7+ Band Score
  Guaranteed"). Per the client's own clarification, Exam/Coaching content
  is design-language-only. Only the generic form/layout grammar (two-column
  hero + form + help rail, field types, consent checkbox, submit button)
  informs our real `/counselling` page — none of the IELTS-specific copy,
  nav item, or breadcrumb is used.
- **`Exams Listing.png` and `Single Exam Coaching.png`** are explicitly
  design-system references only, per the client's instruction. No Exam
  model, API, admin, or route exists or was created. They contributed to
  the shared design tokens below (card composition, tab bar, right-rail
  pattern, testimonial-carousel pattern reused for our real Testimonials)
  and nothing else.
- **Filter-sidebar placement is inconsistent within the reference set
  itself** — Country Listing puts filters on the right (paired with the
  counselling card); University/Subject/Scholarship Listings put filters on
  the left. This implementation standardizes on **left filters** for every
  listing (matching the majority of the reference set and existing site
  convention), and keeps the right rail dedicated to the counselling/help
  card + contextual facts, which is the one placement that is consistent
  across all 18 references.

## Screenshot inventory

| # | File | Dimensions | Mapped route | Phase 1 applicability |
| - | --- | --- | --- | --- |
| 1 | Home.png | 1536×1024 | `/` | Applicable (design brief panel excluded) |
| 2 | Country Listing.png | 1536×1024 | `/countries` | Applicable |
| 3 | Single Country.png | 1536×1024 | `/study-in-{countrySlug}` | Applicable |
| 4 | University Listing.png | 1536×1024 | `/universities` | Applicable |
| 5 | Single University.png | 1536×1024 | `/universities/[slug]` | Applicable |
| 6 | University Courses.png | 1536×1024 | `/universities/[slug]/courses` | Applicable |
| 7 | Single University Courses.png | 1536×1024 | `/universities/[slug]/courses/[offeringSlug]` | Applicable |
| 8 | Subject Listing.png | 1536×1024 | `/subjects` | Applicable |
| 9 | Sub-Subject Listing.png | 1536×1024 | `/subjects/[slug]/specializations` | Applicable |
| 10 | Single Subject.png | 1536×1024 | `/subjects/[slug]` | Applicable |
| 11 | Single Subject with University.png | 1536×1024 | Subject detail, "related Universities/Offerings" state | Applicable |
| 12 | Scholarship Listing.png | 1536×1024 | `/scholarships` | Applicable |
| 13 | Single Scholarship.png | 1536×1024 | `/scholarships/[slug]` | Applicable |
| 14 | Study in Canada Scholarship.png | 1536×1024 | `/scholarships?country=canada` (country-filtered state) | Applicable |
| 15 | scholarship to study abroad after 12th.png | 1536×1024 | `/scholarships` degree-level-filtered state | Applicable |
| 16 | Book Free Counselling.png | 1536×1024 | `/counselling` (layout grammar only — content is Exams-flavored, excluded) | Applicable, content excluded |
| 17 | Exams Listing.png | 1536×1024 | none — design-system reference only | Not applicable (explicit client instruction) |
| 18 | Single Exam Coaching.png | 1536×1024 | none — design-system reference only | Not applicable (explicit client instruction) |

No additional routes were invented to match a screenshot filename (e.g. no
"Exams" nav item, no Coaching route).

## Shared design tokens derived from the reference set

- **Max content width**: ~1280px content column within a 1536px canvas
  (roughly matches this app's existing `.shell` container).
- **Gutters**: desktop ~24–32px side padding; tablet ~20px; mobile ~16px.
- **Spacing scale**: 8/12/16/24/32/48/64px rhythm, generous vertical
  section spacing (~64–96px between major sections).
- **Typography**: bold, large sans-serif display headings (36–48px),
  16px body copy, 13–14px meta/label text in uppercase with letter-spacing
  for eyebrows/section kickers.
- **Color**: primary blue accent (`#1657CF`-family — already this app's
  existing `--brand` token), dark navy footer, neutral light-grey page
  background, white cards, a secondary orange accent for CTA emphasis, a
  green accent for positive/funded/success states, muted purple/teal used
  sparingly for icon badges.
- **Cards**: white background, 12–16px radius, 1px neutral border, soft
  shadow on hover, icon badge or thumbnail in top-left, stat row along the
  bottom or right edge.
- **Buttons**: solid blue primary, white/outline secondary, pill or
  12px-radius rectangular, orange used for the single highest-emphasis CTA
  per page.
- **Badges/tags**: pill-shaped, small, colored by semantic meaning
  (featured = blue, funded/verified = green, trending = orange).
- **Tabs**: horizontal underline-style tab bar under the hero on every
  detail page (Overview / Courses / Fees / Scholarships / ... — the exact
  tab set varies per resource but the mechanism is identical everywhere).
- **Filter panel**: left column, ~280px wide, grouped labelled sections
  (checkboxes, a select, a range control), "Apply"/"Clear all" actions.
- **Right assistance rail**: ~340px wide, sticky-feeling stack of an
  avatar-group "N students counselled" trust card with a primary CTA button,
  followed by contextual fact panels ("At a Glance", "Quick Links",
  "Popular X").
- **Footer**: dark navy, 6-column link grid (For Students / For
  Universities / For Consultants / Resources / Company / Legal), social
  icons, copyright line — this already matches the existing `CatalogFooter`
  component closely.
- **Breakpoints**: desktop ≥1024px (multi-column with rail), tablet
  768–1023px (rail moves below content, filters collapse to a drawer),
  mobile <768px (single column, filters and rail both become
  drawers/accordions, tab bar becomes horizontally scrollable).

## Per-page parity assessment

Legend: MATCHED, MATCHED WITH DATA-SAFE DEVIATION, PARTIAL, NOT APPLICABLE,
BLOCKED.

### 1. Home.png → `/`

- Current route status: live, real data (published counts, real nav)
- Header parity: PARTIAL — current header is a minimal two-tier bar, not
  the full mega-menu (Explore/Universities/Courses/... dropdowns) shown in
  the reference
- Hero parity: PARTIAL — current hero is copy-led ("Where will your degree
  take you?") without the reference's illustrated hero image/search-tab
  widget (Find Universities/Courses/Scholarships/Consultants tabs)
- Breadcrumb parity: NOT APPLICABLE (home has no breadcrumb in either version)
- Column/layout parity: MATCHED WITH DATA-SAFE DEVIATION — single-column
  hero + section stack matches structurally; stat numbers are real
  published counts, not the reference's fabricated "50,000+" figures
- Filter/sidebar parity: NOT APPLICABLE (home has no sidebar in either version)
- Card parity: PARTIAL — "Explore the Possibilities" category-card row
  exists in spirit (nav links) but not as the reference's colored icon cards
- CTA parity: MATCHED WITH DATA-SAFE DEVIATION — a counselling CTA exists;
  copy differs, no fabricated trust stats
- Footer parity: MATCHED — existing `CatalogFooter` already matches the
  6-column dark-navy pattern
- Typography/spacing: PARTIAL — different type scale/spacing rhythm from
  the reference
- Desktop/tablet/mobile: desktop verified this pass; tablet/mobile not
  re-verified this pass (last verified in an earlier milestone's Playwright
  suite for the equivalent editorial-page pattern)
- Intentional data-safe deviations: no fabricated stats, no real brand
  logos, no fake review count
- Missing functionality: none — this is a visual-alignment gap, not a
  functional one
- **Final result: PARTIAL**

### 2. Country Listing.png → `/countries`

- Current route status: live, rich real data (13 destinations, per-country
  tuition/post-study-work/intake facts, region filter, A–Z index, published
  consultants section, counselling CTA band)
- Header parity: PARTIAL — same minimal-header gap as Home
- Hero parity: PARTIAL — reference has an illustrated photo hero + stat
  strip; current hero is copy-led with a comparison-focused stat strip
  (real numbers: destinations/universities/courses/scholarships/regions/
  featured)
- Breadcrumb parity: PARTIAL — no visible `Home > Countries` breadcrumb on
  this listing page today (present on detail pages)
- Column/layout parity: MATCHED — region tabs, result grid, A–Z index,
  pagination, consultants section, and counselling CTA are all structurally
  present, matching the reference's section order
- Filter/sidebar parity: PARTIAL — filters currently rendered inline above
  the grid (region tabs) rather than as a right-hand panel; no
  language/city filter yet
- Card parity: MATCHED WITH DATA-SAFE DEVIATION — cards show real tuition
  range/post-study-work/intake per country; no fabricated "Popular"
  ranking claim beyond the real featured flag
- Right rail parity: PARTIAL — a counselling CTA band exists but not as a
  persistent right-hand rail card with avatar stack
- CTA parity: MATCHED WITH DATA-SAFE DEVIATION
- Footer parity: MATCHED
- Typography/spacing: PARTIAL
- Desktop/tablet/mobile: desktop verified this pass
- Intentional data-safe deviations: real per-country tuition/post-study-work
  ranges from `CountryCostProfile`/`CountryWorkProfile`, not invented
- Missing functionality: **found and fixed this pass** — 17 leftover
  Playwright test fixtures ("Acceptance Demo * Consultant/University/...")
  were rendering live in the Consultants section; purged (see progress doc)
- **Final result: PARTIAL** (functionally strong; visual-rail and
  breadcrumb alignment remain)

### 3. Single Country.png → `/study-in-{countrySlug}`

- Current route status: live, canonical URL matches client spec exactly
- Header/breadcrumb parity: PARTIAL / MATCHED (breadcrumb exists here)
- Hero parity: PARTIAL — reference hero includes a flag chip and stat
  strip inline; current hero is simpler
- Tabs parity: PARTIAL — reference uses a full tab bar (Overview/
  Universities/Courses/Scholarships/Cost of Study/Student Guide/Visa
  Guide/FAQs); current page is a single scrolling page with jump-nav
  anchors, not true tabs
- Right counselling rail parity: MATCHED WITH DATA-SAFE DEVIATION — a
  counselling section exists; not yet a persistent sticky rail card
- "Popular Cities" parity: MATCHED WITH DATA-SAFE DEVIATION — real City
  model data renders here (Milestone 6); currently empty because no City
  records exist in the demo seed (fixed this pass, see progress doc)
- "Top Universities" carousel: PARTIAL — no ranking-carousel exists (by
  design — QS-style ranking numbers in the reference are fabricated per
  real university and cannot be reproduced without inventing rankings)
- FAQ parity: MATCHED — real `CountryFaq` data renders, `FAQPage` JSON-LD
  present (Milestone 10)
- **Final result: PARTIAL**

### 4. University Listing.png → `/universities`

- Current route status: live, but on the **older unpolished generic
  template** (`PhaseListing`) — confirmed by direct inspection this pass;
  this exact gap was already flagged and explicitly deferred in an earlier
  phase of this project
- Header/hero/filter/card/right-rail parity: PARTIAL across the board —
  current page is a bare search box + text list, no filter sidebar, no
  stat badges, no right-rail counselling card, no "Claim your university"
  banner
- **Final result: PARTIAL** (addressed this pass — see progress doc for the
  reskin scope actually delivered)

### 5. Single University.png → `/universities/[slug]`

- Same generic-template gap as the listing. Claim CTA already exists
  functionally (Milestone 7) as a plain text link, not the reference's
  structured detail-page treatment (logo box, verified badge, tab bar,
  right-rail counselling card, at-a-glance panel).
- **Final result: PARTIAL**

### 6. University Courses.png → `/universities/[slug]/courses`

- Filters exist functionally (tuition/course-level, Milestone 9) but not
  on this visual template.
- **Final result: PARTIAL**

### 7. Single University Courses.png → `/universities/[slug]/courses/[offeringSlug]`

- Real data renders; reference's "Enquire Now" contextual lead form is not
  present (only the global `/counselling` flow exists).
- **Final result: PARTIAL**

### 8. Subject Listing.png → `/subjects`

- Current route status: live, structurally rich (A–Z, by-field, by-degree-
  level, featured subjects, honest "career pathways not yet published"
  empty state — a genuinely good data-safety example already in place)
- Card/icon-grid parity: PARTIAL — current cards are text-forward, not the
  reference's icon-badge tile grid
- Right rail parity: PARTIAL — no persistent counselling rail card
- **Final result: PARTIAL** (functionally the strongest listing page in the
  app; visual polish remains)

### 9. Sub-Subject Listing.png → `/subjects/[slug]/specializations`

- Real data, functional filters exist (per earlier milestone's parity work
  on this exact page). Visual card style still text-forward vs the
  reference's icon-row cards.
- **Final result: PARTIAL**

### 10. Single Subject.png → `/subjects/[slug]`

- Real data, SEO-aware (Milestone 10 fix applies here). No dedicated tab
  bar or right-rail counselling card yet.
- **Final result: PARTIAL**

### 11. Single Subject with University.png → related-Universities state

- **Final result: PARTIAL** — the underlying data relation (Course →
  UniversityCourseOffering → University, aggregated) exists and is queried
  elsewhere (comparisons, offerings), but this specific "universities
  offering this subject" aggregated view is not yet built as its own UI
  state on the Subject detail page.

### 12. Scholarship Listing.png → `/scholarships`

- Same generic-template gap as University Listing (confirmed this pass:
  bare search box + text list, no filters, no badges, no right rail).
- **Final result: PARTIAL**

### 13. Single Scholarship.png → `/scholarships/[slug]`

- Real data (award amount, deadline, provider, country/university/offering
  relations). No tab bar, no deadline-countdown right-rail card.
- **Final result: PARTIAL**

### 14. Study in Canada Scholarship.png → country-filtered Scholarship state

- The underlying `?country=canada` filter already works server-side
  (confirmed in code this pass). No dedicated "Study in {Country}
  Scholarships" landing treatment with its own heading/copy exists yet.
- **Final result: PARTIAL**

### 15. scholarship to study abroad after 12th.png → degree-level-filtered state

- **BLOCKED on a real filter gap**: Scholarship currently has no
  degree-level or amount-range filter at all (confirmed in code this pass
  and already flagged in the prior scope audit). Addressed this pass — see
  progress doc.
- **Final result: PARTIAL**

### 16. Book Free Counselling.png → `/counselling`

- Current route status: live, real lead-capture form (name/email/phone/
  study level/intake/consent), duplicate-protected, tested. Layout is a
  single-column form, not the reference's three-column
  hero-image/form/help-rail layout. IELTS-specific content excluded per
  client instruction.
- **Final result: PARTIAL**

### 17. Exams Listing.png

- **NOT APPLICABLE** — design-system reference only, per explicit client
  instruction. No route, model, or admin surface exists or was created.

### 18. Single Exam Coaching.png

- **NOT APPLICABLE** — same as above.

## Summary

- MATCHED: 0 of 16 applicable pages fully matched pixel-for-pixel (none
  were expected to be, given the reference is a different visual system
  built by a separate design-tool pass)
- MATCHED WITH DATA-SAFE DEVIATION: present as a partial-credit signal on
  ~6 of 16 pages (real data correctly substituted for fabricated reference
  content in the sections that do exist)
- PARTIAL: 16 of 16 applicable pages — every mapped page has real,
  functioning data underneath but has not yet had a full visual-parity pass
  against this specific reference set
- BLOCKED: 0 remaining after this pass (the one real filter gap found —
  Scholarship degree-level/amount — was fixed, see progress doc)
- NOT APPLICABLE: 2 (both Exam images, by design)

This matrix is the baseline. `docs/phase1-ui-fidelity-final-report.md`
records what changed against this baseline by the end of this work pass,
including a further addendum (its final section) covering a later
"remaining Phase 1 work" pass's live spot-check of Home, Country
Listing, Single Country, Cities, Consultants and Universities — real
verification, not a full re-run of the 16-page matrix above, which
still stands as the authoritative per-page baseline.

A further addendum in that same final report covers a closing pass
that rebuilt Home (row 1 above) from the generic CMS-editorial
fallback into a real polished template with a live stat strip and
quick-link grid, verified across all 6 required breakpoints, and
re-verified all 16 rows above at the primary desktop breakpoint plus a
representative sample at additional breakpoints. Row 4 (University
Listing), row 12 (Scholarship Listing), and the Consultants listing
(not itself a numbered row here, but the same template family) remain
on the plain, previously-deferred template — this matrix's own
per-page notes for those rows are otherwise unchanged.
