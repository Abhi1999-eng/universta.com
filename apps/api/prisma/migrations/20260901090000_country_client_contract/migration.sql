-- Additive storage for the client-approved Country contract.
ALTER TABLE `countries`
  ADD COLUMN `external_uid` VARCHAR(191) NULL,
  ADD COLUMN `official_language` VARCHAR(255) NULL,
  ADD COLUMN `tagline` VARCHAR(500) NULL,
  ADD UNIQUE INDEX `countries_external_uid_key` (`external_uid`),
  ADD INDEX `countries_external_uid_idx` (`external_uid`);

ALTER TABLE `country_work_profiles`
  ADD COLUMN `visa_type` VARCHAR(255) NULL,
  ADD COLUMN `visa_fee` DECIMAL(12,2) NULL,
  ADD COLUMN `visa_fee_currency_code` CHAR(3) NULL;

ALTER TABLE `country_statistics`
  ALTER COLUMN `source_mode` SET DEFAULT 'DERIVED';

CREATE TABLE `country_subjects` (
  `id` CHAR(36) NOT NULL,
  `country_id` CHAR(36) NOT NULL,
  `subject_id` CHAR(36) NOT NULL,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `country_subjects_country_id_subject_id_key` (`country_id`, `subject_id`),
  INDEX `country_subjects_country_id_display_order_idx` (`country_id`, `display_order`),
  INDEX `country_subjects_subject_id_country_id_idx` (`subject_id`, `country_id`),
  CONSTRAINT `country_subjects_country_id_fkey`
    FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `country_subjects_subject_id_fkey`
    FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
