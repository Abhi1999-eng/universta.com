-- Where a destination's indicative tuition for a course comes from.
--
-- The same fact was recorded in two places that never looked at each other.
-- `country_courses` carries an indicative range for "this course in this
-- country"; `university_course_offerings` carries what a named institution
-- in that country actually charges for it. Nothing reconciled them, so they
-- could -- and did -- drift apart silently, and a destination could quote a
-- figure no university behind it charges.
--
-- The offerings are the reality: a real institution, a real programme, a
-- real price. The country-level range is a summary of them, so it is worked
-- out from them: lowest minimum and highest maximum across the live
-- offerings at universities in that country.
--
-- An editor still has the last word. When one sets the figures by hand the
-- row is marked as an override and the derivation leaves it alone, so a
-- sourced number is never quietly replaced by an arithmetic one.
--
-- Every row that exists today was typed in and nothing has been derived
-- yet, so they all start as overrides. The backfill then clears the flag on
-- the ones that have offerings to speak for them.
ALTER TABLE `country_courses`
  ADD COLUMN `tuition_is_override` BOOLEAN NOT NULL DEFAULT true;

-- The reconciler sweeps one country's course mappings at a time and only
-- rewrites the derived ones.
CREATE INDEX `country_courses_country_id_tuition_is_override_idx`
  ON `country_courses` (`country_id`, `tuition_is_override`);
