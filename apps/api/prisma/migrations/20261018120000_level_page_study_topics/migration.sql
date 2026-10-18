-- One more written section on a level page: the topics a programme at this
-- level usually covers ("What you may study"). Sanitised rich text like the
-- notes; null when nothing is written. It does not count towards indexing.
ALTER TABLE `subject_level_pages`
    ADD COLUMN `study_topics` LONGTEXT NULL AFTER `intro`;
