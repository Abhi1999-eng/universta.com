-- What a student actually wants to know about an institution, and where it
-- came from.
--
-- The record carried a name, a type, a QS rank and two paragraphs of prose.
-- Everything a student compares institutions on -- how big it is, how many
-- students come from abroad, how many of them there are per member of
-- staff, how old it is -- had nowhere to live, so the page could not show
-- it however well the catalogue was filled in.
--
-- These are somebody else's figures, not ours, and they go stale. So they
-- travel with their source and the year it was published, the same way a
-- ranking already does: the page can then say who counted and when, and a
-- reader can check. A figure without a source is still allowed -- an
-- editor may have it before they have the citation -- but the page says so
-- rather than implying authority it does not have.
ALTER TABLE `universities`
  ADD COLUMN `total_students` INT NULL,
  ADD COLUMN `international_students_percent` DECIMAL(5, 2) NULL,
  ADD COLUMN `student_faculty_ratio` DECIMAL(5, 2) NULL,
  ADD COLUMN `established_year` SMALLINT NULL,
  ADD COLUMN `campus_setting` VARCHAR(30) NULL,
  ADD COLUMN `website_url` VARCHAR(2048) NULL,
  ADD COLUMN `admissions_email` VARCHAR(255) NULL,
  ADD COLUMN `phone` VARCHAR(50) NULL,
  ADD COLUMN `stats_source_name` VARCHAR(150) NULL,
  ADD COLUMN `stats_source_url` VARCHAR(2048) NULL,
  ADD COLUMN `stats_year` SMALLINT NULL;
