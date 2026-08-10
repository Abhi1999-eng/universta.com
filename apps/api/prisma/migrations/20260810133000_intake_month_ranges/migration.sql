-- Preserve existing intake relationships while converting the study-period
-- month into a start/end range. Application-window months are untouched.
ALTER TABLE `intakes`
  ADD COLUMN `start_month` TINYINT NULL,
  ADD COLUMN `end_month` TINYINT NULL;

UPDATE `intakes`
SET `start_month` = `month_number`,
    `end_month` = `month_number`
WHERE `month_number` IS NOT NULL;

ALTER TABLE `intakes` DROP COLUMN `month_number`;
