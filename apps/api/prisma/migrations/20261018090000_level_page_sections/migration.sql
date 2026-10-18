-- Three more written sections on a level page: the industries and employers
-- its graduates go to, and a look ahead. Sanitised rich text like the notes;
-- null when nothing is written. They do not count towards indexing.
ALTER TABLE `subject_level_pages`
    ADD COLUMN `industries` LONGTEXT NULL AFTER `careers_note`,
    ADD COLUMN `employers` LONGTEXT NULL AFTER `industries`,
    ADD COLUMN `looking_ahead` LONGTEXT NULL AFTER `employers`;
