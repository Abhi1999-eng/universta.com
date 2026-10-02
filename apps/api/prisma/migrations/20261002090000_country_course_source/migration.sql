-- Where a country's link to a course came from.
--
-- `country_subjects` and `country_sub_subjects` already carry this, and the
-- reconciler that fills them reads `country_courses` to decide what a
-- destination teaches. But nothing ever filled `country_courses` itself --
-- every row was typed in, by the country sheet or by hand in the admin --
-- so the chain had no beginning. A university could offer a course in a
-- country and the country would not be linked to it, which is why only 3
-- of 4,695 mappings had a priced offering behind them.
--
-- A country offers a course when one of its published universities has a
-- published offering for it. That is a fact about the catalogue, so it is
-- worked out rather than remembered, and it comes and goes with the
-- offerings.
--
-- What an editor meant on purpose survives. A destination whose guide is
-- written before its universities are loaded still needs its courses, and
-- a sweep must not empty it. Those rows are EDITORIAL and the reconciler
-- adds and removes DERIVED rows only.
--
-- Everything that exists today was typed in, so it starts as EDITORIAL and
-- is left alone -- the same way the subject columns were introduced.
ALTER TABLE `country_courses`
  ADD COLUMN `source` VARCHAR(20) NOT NULL DEFAULT 'EDITORIAL';

-- The reconciler sweeps one course across every destination, and one
-- destination across its derived rows, so both directions are indexed.
CREATE INDEX `country_courses_course_id_source_idx`
  ON `country_courses` (`course_id`, `source`);

CREATE INDEX `country_courses_country_id_source_idx`
  ON `country_courses` (`country_id`, `source`);
