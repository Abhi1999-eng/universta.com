# Universta Phase 1 — Acceptance Program Final Completion Report

Strict, field-by-field admin acceptance testing across all 8 required modules,
run against the deployed production system
(`https://54.162.49.131.nip.io`, `https://admin.54.162.49.131.nip.io`,
`https://api.54.162.49.131.nip.io`). Every check in this program follows the
same method: inventory every field/control, exercise it independently
including boundary and invalid input, verify the saved value through the
API, verify the resulting effect on the public site, check desktop/tablet/
mobile, fix any defect found, deploy the fix, re-verify it live, and record
the outcome as one row of `03-test-matrix.md`.

## Scope covered

| # | Module | Status |
| --- | --- | --- |
| 1 | Media | ✅ Complete |
| 2 | SEO | ✅ Complete |
| 3 | Internal Linking | ✅ Complete |
| 4 | Comparisons | ✅ Complete |
| 5 | Bulk Actions and Import/Export | ✅ Complete |
| 6 | Scheduling | ✅ Complete |
| 7 | Global Settings | ✅ Complete |
| 8 | Authentication / Users / Roles / Permissions | ✅ Complete |

All 8 modules named in the acceptance scope are complete, in the order
specified. Alongside these, the ten catalog/content modules (Countries,
Subjects, Universities, Courses, Scholarships, Consultants, Jobs, Events,
Success Stories, Testimonials) and four platform-composition modules
(Homepage, Navigation, Footer, Pages) were already carried through the same
process in earlier segments of this program and are included in the totals
below.

## Coverage totals

**598 checks across 22 modules — 594 pass, 0 fail, 4 not applicable.**

The 4 N/A rows are not gaps: each documents a specific precondition that
genuinely didn't exist to test against at the time (e.g. no `DRAFT`
university existed to test an internal `internal://` link against one; a
QA-created course was deliberately never published, so its unpublish action
had nothing to exercise), and each says so directly in its own row rather
than being silently omitted.

Full row-level detail — admin page, control, field, test value, invalid
input tried, expected vs. actual in both the admin and the public site,
responsive behaviour at 3 breakpoints, and the exact Playwright spec that
produced each result — is in
[`03-test-matrix.md`](./03-test-matrix.md).

## Defects found and resolved

**38 issues (ISS-001 through ISS-039, ISS-022 unused) were logged over
the full program. 35 are fixed, deployed to production, and re-verified
live. 3 remain open, each with an explicit classification** (see below).
Full root-cause analysis, the fix, the PR, and the live re-verification for
every issue is in [`02-bug-report.md`](./02-bug-report.md).

Of the 35 fixed:
- 7 were **Blocker/Critical** (e.g. ISS-001: seven of ten content modules
  held zero production data; ISS-021: the media library's "in use" check
  missed most real consumers, risking silent deletion of media still
  referenced elsewhere; ISS-025: every media upload had been crashing since
  launch because the release directory was read-only; ISS-029: a fast login
  could be silently wiped by an unrelated pre-login token refresh, bouncing
  the admin straight back to the login screen; ISS-032: no pagination
  anywhere in the shared Phase 1 resource list screen, making records past
  the 12th permanently unreachable; ISS-033: admin-configured redirects had
  zero effect on the live site; ISS-039: a protocol-relative `//host` URL
  bypassed the Settings open-redirect guard — a real security fix).
- The remainder span every layer: web rendering, API validation and error
  handling, admin form behaviour, SEO metadata, scheduling date-range logic,
  bulk-operation type coercion, and infrastructure (Nginx upload limits).

### The two issues named for closure with live verification

**ISS-004 — fictional public meta descriptions.** Both originally-named
evidence spots (the Canada country page and the `diploma-cybersecurity`
course page) turned out to be one shared template problem: all 12
countries shared one `shortDescription` placeholder, and all 12 generic
courses shared another. Fixed for all 24 records by composing honest
descriptions strictly from each record's own already-entered, verified
data (tuition range, work-rights flags, qualification name/level) — no new
facts were invented. Live-verified: neither page's meta description
matches `/fictional/i` any more. A much broader, 122-occurrence "fictional
… fixture for local testing" pattern was found spanning nearly the entire
demo seed dataset (country work/visa profiles, university campuses,
consultant locations, scholarships, events, testimonials, course
requirements) — logged, but explicitly out of scope for this pass, since
closing it would mean fabricating specific real-world facts (visa policy,
institutional detail) rather than composing from data already on record.

**ISS-018 — Website Builder's per-page SEO link ignored context.** Root
cause: the link was hardcoded to `/seo` regardless of which page it was
clicked from. Fixed to carry `?key=<seoKey>`, with the SEO hub reading it
and auto-opening the matching row. Live re-verification of that fix
surfaced a second, related defect: the Home page's own link still didn't
work, because its `seoKey` pointed at a key already retired by an earlier
fix (ISS-026) — the live homepage route actually reads the
`countries-listing` SEO record, not a standalone `home` one. Fixed and
re-verified: `/seo?key=countries-listing` now opens with 5 editable fields
from the Home row's link. A regression test now asserts every entry's
`seoKey` resolves to a real record, so a future key removal can't silently
strand another page's link the same way.

### The 3 that remain open — explicit classification

| ID | Classification | Reason |
| --- | --- | --- |
| ISS-013 | Deferred-with-approval | A junk record (`hvhjhj` / slug `/lk`) sits live in the client's own Universities data. Deleting a client's production record is theirs to authorise, not ours to do unilaterally. |
| ISS-014 | Deferred-with-approval | Cosmetic-only ("Add Campuse" pluralisation bug), batched with other low-priority copy fixes rather than shipped as a one-off unreviewed change. |
| ISS-031 | Deferred-with-approval | A Listing-type editorial page's own CMS sections are never rendered on its live route. Not a data-loss risk — everything saved persists correctly via the API — but *where* those sections should appear relative to the catalog grid is a product/design decision, not ours to make unilaterally. |

No issue in this program is classified Must-fix-and-unresolved: every
Must-fix-severity defect found was fixed and re-verified live. The 3 that
remain open are all Deferred-with-approval by nature (data ownership,
cosmetic batching, or a design decision outside this program's authority),
plus the separately-logged Content-via-admin gap noted under ISS-004 above.

## Method notes worth carrying forward

- Every fix in this program is backed by a unit test that was confirmed,
  via `git stash`, to genuinely fail without the fix — not just a test that
  happens to pass.
- Every fix was deployed to production and re-verified against the live
  system, not just checked in a local environment.
- Global/singleton resources (Settings) were tested with a
  capture-baseline / try-finally-restore / final-byte-for-byte-verification
  pattern so the acceptance program never left production state altered.
- The one destructive scenario in this program (the account-lockout
  boundary in Module 8) was deliberately **not** exercised against the real
  demo account, since doing so would risk locking out the only admin
  account this whole program depends on — it was instead pinned with a
  fake-Prisma unit test.

## Sign-off

All 8 required modules are complete. All Must-fix-severity defects found
during the program are fixed, deployed, and live-verified. Both issues
specifically named for closure (ISS-004, ISS-018) are resolved and
live-verified, including a follow-on defect ISS-018's own fix exposed. The
3 remaining open issues are non-blocking and each carries an explicit
classification and rationale for staying open. The coverage matrix stands
at 598 checks, 594 pass, 0 fail, 4 N/A.
