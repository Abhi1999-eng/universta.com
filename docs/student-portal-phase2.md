# Student portal Phase 2

Phase 2 extends the existing student identity, profile and document boundary.
It does not copy catalogue records: saved items and applications reference the
published University, University Course Offering and Scholarship records that
the student actually selected.

## Student journey

1. A registered student completes their Phase 2-A profile and uploads private
   documents.
2. From a published university, offering or scholarship page they can save the
   record. Saving is idempotent and unavailable catalogue records cannot be
   newly saved.
3. An offering starts a University Course Offering application. The portal
   records the catalogue name as a small historical snapshot, document links,
   and a timeline. Submission, withdrawal and offer acceptance/rejection are
   explicit state transitions.
4. Scholarship applications follow the same owner-scoped timeline and document
   linking model.
5. The student portal provides a consultant conversation, persisted
   notifications, support tickets, deterministic profile-based offering
   recommendations, and a stable referral code.

## Safety boundaries

- Every student route resolves `studentProfileId` from the verified student
  access token; it never accepts it in a URL, query parameter or request body.
- Saves and applications first re-check publication and soft-delete state.
- Student document attachment checks that every linked document belongs to the
  current profile.
- Staff lifecycle operations use the separate Admin token audience and the
  existing `SUPER_ADMIN` role guard.
- Email delivery remains an explicit provider boundary. Portal notifications are
  persisted in-app; a configured transport can later deliver the same event
  without changing lifecycle callers.

## Operational status model

- University applications: `APPLICATION_STARTED`, `SUBMITTED`,
  `UNDER_REVIEW`, `OFFER_RECEIVED`, `REJECTED`, `WITHDRAWN`.
- Scholarship applications: `STARTED`, `SUBMITTED`, `UNDER_REVIEW`,
  `AWARDED`, `REJECTED`, `WITHDRAWN`.
- Support: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`.

The migration `20260815120000_add_student_portal_phase2` is additive. It does
not alter catalogue, lead, authentication or Phase 2-A profile data.
