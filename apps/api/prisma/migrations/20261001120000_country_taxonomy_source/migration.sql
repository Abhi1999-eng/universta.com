-- Where a country's subject and specialization links came from.
--
-- They were all typed in: by an editor in the country editor, or by the
-- `subject` column of the country sheet. Nothing checked them against the
-- courses actually taught there, so a destination could claim Engineering
-- with no engineering course behind it, and could teach engineering courses
-- without claiming the subject at all.
--
-- Most of these links can be worked out instead -- a country teaches a
-- subject when a published course in that subject is mapped to it -- and
-- the ones that are worked out should be able to come and go with the
-- courses. The ones an editor means on purpose, for a market the catalogue
-- has not caught up with yet, must survive that.
--
-- Everything that exists today was typed in, so it starts as EDITORIAL and
-- is left alone. The reconciler adds and removes only DERIVED rows.
ALTER TABLE `country_subjects`
  ADD COLUMN `source` VARCHAR(20) NOT NULL DEFAULT 'EDITORIAL';

ALTER TABLE `country_sub_subjects`
  ADD COLUMN `source` VARCHAR(20) NOT NULL DEFAULT 'EDITORIAL';

-- The reconciler sweeps one country at a time and only ever touches the
-- derived rows, so both tables are read by (country, source).
CREATE INDEX `country_subjects_country_id_source_idx`
  ON `country_subjects` (`country_id`, `source`);

CREATE INDEX `country_sub_subjects_country_id_source_idx`
  ON `country_sub_subjects` (`country_id`, `source`);
