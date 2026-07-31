# Universta Phase 1 — Client Demo Script

A 15–20 minute walkthrough. The order below builds one argument: *students get a
complete, credible study-abroad site, and your team runs all of it without
calling a developer.*

Everything shown runs locally on a laptop. Nothing described here is deployed to
a public server yet — see **Saying the local-only part** at the end for wording.

---

## Before you start (2 minutes, off-camera)

- Local API, public site and Admin console running.
- Signed into the Admin console in a second browser tab, so you never type a
  password on screen.
- Browser at roughly 1440×900. Close unrelated tabs, bookmarks bar and any
  terminal window.
- Have one phone-sized window ready (390×844) for the responsive moment.

Demo records are deliberately fictional — "Northstar Demonstration University",
"Lakeside Demo Consultant". Say so once, early. It protects you from any
suggestion that the site is presenting invented institutions as real.

---

## 1. The public site (5–6 minutes)

### Home — *"This is what a student sees"*

Open the home page. Point at the header.

> "Everything in this navigation is managed by your team. The menu, the labels,
> the order and the call-to-action button are all edited in the Admin console —
> there's no developer in that loop."

Scroll to the footer. Same point, briefly.

**Business benefit:** marketing changes ship in minutes, not sprints.

### Destinations — *"Students start with a country"*

Countries listing → search → open one country.

> "Destination pages carry your own guidance content, and they connect to the
> universities, cities and consultants you've already published."

Show breadcrumbs and the counselling call to action.

**Business benefit:** every page routes towards an enquiry.

### Universities — *"This is the catalogue in action"*

Universities listing. Do three things slowly:

1. Type in search.
2. Apply the destination filter.
3. Change the sort.

Then point at the address bar.

> "Notice the web address changed. A counsellor can filter this list and send
> the exact result set to a student — the link reopens the same view."

Open a university → its courses → one course offering.

> "Tuition, level, study mode, duration, intake and entry requirements all come
> from the record your team maintains. Update it once, and it's correct
> everywhere it appears."

**Business benefit:** one source of truth; no stale duplicates across pages.

### Scholarships and consultants (fast)

Scholarships listing — filter by country, then open one.

Consultants listing — show that you can filter by location, service, language,
destination and verification.

> "Verification here means *your team* checked this consultant. It's a status
> you control — it isn't a rating and it isn't a score."

**Say this only if asked about rankings or ratings:**

> "We deliberately don't display ratings, rankings or success rates. The
> platform doesn't hold that data, and showing invented numbers would put you at
> risk. When you have a real, defensible source, we can surface it."

### Comparison (30 seconds)

Open a comparison with three universities. Refresh the page.

> "The comparison survives a refresh and can be shared as a link — that's how a
> counsellor sends a shortlist to a family."

---

## 2. Admin to public — the important part (7–8 minutes)

This section is the one that changes the conversation. Everything before it
could be a static website; this proves it isn't.

### The console

> "Only authorised team members can get in here. The sidebar is grouped by the
> job you're doing, not by how the software is built."

### Website Builder — *"Every page in one list"*

Open Website Builder → Website Pages.

> "All 33 public pages and page templates are in this one searchable list. Your
> team never has to know a web address to edit a page."

Open **About Us**.

> "Everything for this page is on one screen — the content sections, the search
> engine settings, the header and footer, preview, and the full change history."

### The round trip — *do this slowly, it lands hard*

1. Add a section and give it a heading.
2. Turn off "Show on Mobile" for that section.
   > "The same page can show a section on desktop and hide it on a phone."
3. Save.
4. **Switch to the public page and refresh.** It isn't there.
   > "Drafts stay private. Students never see work in progress."
5. Back in the Builder, open Preview and click Desktop, Tablet, Mobile.
   > "These are real device widths, not a picture of one."
6. Publish.
7. **Refresh the public page.** It's there.

> "That's the whole content workflow: write, preview, publish — with no
> deployment and no developer."

### Version history

Open Version History → Compare → Restore.

> "Every change is recorded with who made it and when. You can compare two
> versions in plain language and roll back. Restoring creates a *new* version —
> it never erases the history, and it never publishes anything by surprise."

**Business benefit:** a junior team member can edit confidently, because
mistakes are reversible.

### Templates — *"Change one page, change five hundred"*

Open University Detail Template. Pick a real university from the preview list.

> "This one template controls the layout of every university page. Preview it
> against any real university. Change it once and every university page follows
> — but the university's own information is untouched, because that lives on the
> record, not the template."

### Global header and footer

Change the header call-to-action label, save, show the public site, change it
back.

> "One edit, every page."

### Catalogue management (pick two, don't do all of them)

Universities: edit a field → save → show it publicly → unpublish → show the page
is gone → republish.

> "Publication is a switch your team controls. Nothing goes live by accident and
> nothing stays live when you need it down."

Consultants: show that **verified** and **published** are two separate switches.

> "You can publish a consultant you haven't verified yet, or verify one before
> you publish. They're independent on purpose."

### Enquiries — *"Where the revenue starts"*

Submit a contact enquiry on the public site. Find it in the Admin. Convert it
into a counselling lead. Try converting it a second time.

> "It won't create a duplicate. One student enquiry becomes exactly one lead,
> with its status history attached."

**Business benefit:** no double-handling, no lost enquiries.

---

## 3. Responsive (1–2 minutes)

Switch to the phone-sized window. Show:

- the navigation drawer opening,
- a listing page's filters,
- one detail page.

> "Most of your students will arrive on a phone. The filters, the drawer and the
> forms are all usable at this size."

---

## 4. Bulk operations (only if the client asks about data volume)

> "Your team can download a spreadsheet template, fill it in, and validate it
> *before* importing. Bad rows are reported back rather than quietly corrupting
> the catalogue. You can export the same way for reporting."

---

## What still needs the client

Be direct about these — they are decisions and content, not missing software.

| Needed | Why it matters |
| --- | --- |
| Real university, course and scholarship data | The catalogue is running on clearly fictional demo records |
| Final brand copy for Home, About, FAQ | Present wording is placeholder |
| Logo and brand imagery | Currently a text wordmark |
| Contact details, privacy policy, terms | These appear in the footer on every page |
| A decision on ratings/rankings | We show none today; displaying them needs a defensible data source |
| A decision on the "Create account" link | Built as a configurable link, hidden until a destination is set — no student login exists in Phase 1 |
| Domain, hosting and email sending | Required before anything is public |

---

## Saying the local-only part

Use this wording, not an apology:

> "Everything you've seen is running on a local environment — that's the normal
> checkpoint at the end of a build phase. The next step is hosting, your domain
> and your real content. The functionality you've just watched doesn't change
> when we deploy it."

Do **not** say the platform is live, deployed or in production. It isn't.

---

## Likely questions, short answers

**"Can my team really change all of this without a developer?"**
Yes — every page, the navigation, the header and footer, SEO settings and the
whole catalogue. Bring a laptop to the next session and we'll have someone from
your team make a change live.

**"What happens if someone breaks a page?"**
Every change is versioned. You compare and roll back from the same screen, and
restoring never publishes anything on its own.

**"Can students create accounts?"**
Not in Phase 1. There's a configurable link ready for when you want one, and it
stays hidden until you set a destination.

**"Why don't I see ratings or rankings?"**
The platform holds no such data. Showing invented numbers would be a real
liability. Give us a defensible source and we can display it.

**"How do we load our real data?"**
Either through the Admin screens, or in bulk from a spreadsheet with validation
before anything is written.

**"Is it mobile-friendly?"**
Yes — and you can control, per section, what appears on a phone versus a
desktop.

**"How soon can this be live?"**
Once we have hosting, your domain and your content. The build you've seen is the
build that gets deployed.

---

## Don't over-explain

Skip these unless someone technical asks directly. They cost time and buy no
confidence:

- database relationships and publication guards
- token handling and session security
- caching, rendering strategy and build tooling
- test counts and the regression suite
- how preview links are secured

If pressed, one sentence each is plenty:

> "Draft content is protected by short-lived preview links, so it can't leak by
> someone sharing a URL."
