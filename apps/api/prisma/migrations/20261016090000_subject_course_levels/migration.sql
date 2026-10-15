-- The study levels an editor says a subject, or a specialization, is offered
-- at. The public pages still work levels out from published courses; these
-- ticks are added to that, so a level shows before any course is filed under
-- it. One row per pair, removed with the record it belongs to.
CREATE TABLE `subject_course_levels` (
  `id` CHAR(36) NOT NULL,
  `subject_id` CHAR(36) NOT NULL,
  `course_level_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `subject_course_levels_subject_id_course_level_id_key`(`subject_id`, `course_level_id`),
  INDEX `subject_course_levels_course_level_id_idx`(`course_level_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `subject_course_levels`
  ADD CONSTRAINT `subject_course_levels_subject_id_fkey`
  FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `subject_course_levels`
  ADD CONSTRAINT `subject_course_levels_course_level_id_fkey`
  FOREIGN KEY (`course_level_id`) REFERENCES `course_levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `sub_subject_course_levels` (
  `id` CHAR(36) NOT NULL,
  `sub_subject_id` CHAR(36) NOT NULL,
  `course_level_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `sub_subject_course_levels_sub_subject_id_course_level_id_key`(`sub_subject_id`, `course_level_id`),
  INDEX `sub_subject_course_levels_course_level_id_idx`(`course_level_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `sub_subject_course_levels`
  ADD CONSTRAINT `sub_subject_course_levels_sub_subject_id_fkey`
  FOREIGN KEY (`sub_subject_id`) REFERENCES `sub_subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `sub_subject_course_levels`
  ADD CONSTRAINT `sub_subject_course_levels_course_level_id_fkey`
  FOREIGN KEY (`course_level_id`) REFERENCES `course_levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
