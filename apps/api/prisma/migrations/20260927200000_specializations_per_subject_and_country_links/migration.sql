-- A specialization's slug is unique within its subject, not across all of them.
-- The same branch is taught under several fields -- "Animal Science" sits under
-- Agriculture, Science and Biological & Life Sciences -- and the page it
-- addresses is /subjects/<subject>/<slug>, which already names the subject.
ALTER TABLE `sub_subjects` DROP INDEX `sub_subjects_slug_key`;
ALTER TABLE `sub_subjects` ADD UNIQUE INDEX `sub_subjects_subject_id_slug_key` (`subject_id`, `slug`);

-- Which specializations a destination is offered for. Mirrors country_subjects.
CREATE TABLE `country_sub_subjects` (
  `id` CHAR(36) NOT NULL,
  `country_id` CHAR(36) NOT NULL,
  `sub_subject_id` CHAR(36) NOT NULL,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `country_sub_subjects_country_id_sub_subject_id_key`(`country_id`, `sub_subject_id`),
  INDEX `country_sub_subjects_country_id_display_order_idx`(`country_id`, `display_order`),
  INDEX `country_sub_subjects_sub_subject_id_country_id_idx`(`sub_subject_id`, `country_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `country_sub_subjects`
  ADD CONSTRAINT `country_sub_subjects_country_id_fkey`
  FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `country_sub_subjects`
  ADD CONSTRAINT `country_sub_subjects_sub_subject_id_fkey`
  FOREIGN KEY (`sub_subject_id`) REFERENCES `sub_subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
