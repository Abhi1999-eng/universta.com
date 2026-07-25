# Approved UI reference inventory

This inventory records the five approved HTML references uploaded for the UI
parity phase. The HTML files are preserved byte-for-byte in
`design/reference/` and are documentation/design inputs only; they are never
loaded by the production application.

| Original filename | Canonical repository filename | Intended route | Page type | Status |
| --- | --- | --- | --- | --- |
| `Final countries List.html` | `final-countries-list.html` | `/countries` | Country listing and destination directory | Adapted production route |
| `universta-country.html` | `final-country-detail.html` | `/countries/[slug]` | Country detail/editorial guide | Adapted production route |
| `subjects Listing.html` | `subjects-listing.html` | `/subjects` | Subject discovery and directory | Adapted production route |
| `subject-details.html` | `subject-detail.html` | `/subjects/[slug]` | Subject detail and pathway guide | Adapted production route |
| `Subjects Sub Categories.html` | `subject-specializations.html` | `/subjects/[slug]/specializations` | Subject specialisations listing | Implemented as a safe data-backed adaptation |

## Reference: `Final countries List.html`

- Dynamic entities in the sample: countries, regions, country metrics,
  consultants, search suggestions, and alphabetical directory entries.
- Desktop composition: branded navigation, large destination hero, search and
  quick-filter band, region tabs, three-column cards, alphabetical directory,
  consultation CTA, consultant cards, and footer.
- Tablet/mobile composition: stacked search controls, wrapped quick filters,
  compact cards, responsive directory columns, and mobile navigation.
- Interactions: country search suggestions, region tabs, result cards, A–Z
  navigation, and counselling CTAs.
- Safe adaptation: all counts, metrics, filter values, country facts, and
  consultant content come from published API/Admin data. Unsupported sample
  metrics and comparison-like claims are omitted.

## Reference: `universta-country.html`

- Dynamic entities in the sample: a country, verified profile sections,
  courses/universities, intakes, visa/cost content, FAQs, events, cities,
  career content, blogs, and consultants.
- Desktop composition: destination hero, sticky jump navigation, alternating
  editorial sections, profile facts, CTA bands, consultants, and footer.
- Tablet/mobile composition: stacked hero, horizontally scrollable jump links,
  single-column editorial sections, and full-width CTA cards.
- Interactions: sticky section navigation, safe consultation CTA, and FAQ/
  editorial navigation where published content exists.
- Safe adaptation: only the existing structured country profiles, published
  editorial sections, FAQs, and Admin-managed consultant cards render. Sample
  rankings, salaries, scholarships, visa guarantees, events, and testimonials
  are not invented.

## Reference: `subjects Listing.html`

- Dynamic entities in the sample: subjects, subject categories, A–Z entries,
  degree levels, career pathways, featured subjects, destinations, courses,
  scholarships, employers, resources, stories, and FAQs.
- Desktop composition: subject hero/search, popular cards, category cards,
  A–Z directory, featured cards, resource/CTA sections, and footer.
- Tablet/mobile composition: stacked search, one-column cards, two-column A–Z
  groups, wrapped navigation, and full-width CTA sections.
- Interactions: search, A–Z anchors, cards, FAQ disclosure, and safe discovery
  links.
- Safe adaptation: published subject cards, featured subjects, and A–Z groups
  are rendered from the subject API. Categories, careers, universities,
  scholarships, employer claims, stories, and FAQs are omitted because no
  verified Phase 1 source exists for them.

## Reference: `subject-details.html`

- Dynamic entities in the sample: one subject, levels, specialisations,
  careers, industries, countries, universities, courses, scholarships,
  admissions, cost, dashboard metrics, stories, match tooling, related
  subjects, resources, consultants, and FAQs.
- Desktop composition: subject hero with actions, sticky table of contents,
  at-a-glance facts, editorial blocks, cards, right-side snapshot, CTA, and
  footer.
- Tablet/mobile composition: stacked hero, horizontal sticky navigation,
  single-column cards, and static safe CTA.
- Interactions: section navigation and published course/specialisation links.
- Safe adaptation: overview, published counts, course-level counts,
  specialisations, featured courses, SEO metadata, and safe course links are
  rendered. Save, compare, matching, salary, ranking, scholarship, review,
  testimonial, and unsupported resource actions are omitted or deferred.

## Reference: `Subjects Sub Categories.html`

- Dynamic entities in the sample: specialisations, categories, careers,
  universities, courses, scholarships, countries, skills, trends, stories,
  resources, FAQs, and comparison tray/modal state.
- Desktop composition: specialisation hero/search, popular cards, category
  blocks, all-specialisations grid, supporting discovery sections, CTA, and
  footer.
- Tablet/mobile composition: stacked search and cards, responsive grids,
  accessible navigation, and full-width CTA.
- Interactions: published specialisation links only. The reference comparison
  tray/modal is intentionally not interactive because Subject Comparison is
  outside the approved scope.
- Safe adaptation: the route renders published Sub-Subjects for the requested
  parent subject, with empty state and course links. Sample demand, salary,
  growth, university, scholarship, and testimonial values are omitted.

## Deferred and factual-data policy

Reference actions such as Sign in, Save, Compare, Apply, eligibility matching,
AI matching, dashboards, scholarships, rankings, calculators, applications,
and consultant platforms are hidden or rendered as non-interactive explanatory
copy. No fake route is created for a deferred action. Null values remain
unknown; explicit zero values remain zero. Production pages use published API
data, verified country profiles, or existing safe fallback copy only.
