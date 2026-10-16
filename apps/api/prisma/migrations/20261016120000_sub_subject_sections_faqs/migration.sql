-- A specialization's own content, as a course has: named sections and FAQs,
-- written in its editor and shown on its public page. Mirrors
-- course_content_sections and course_faqs; removed with the specialization.
CREATE TABLE `sub_subject_content_sections` (
    `id` CHAR(36) NOT NULL,
    `sub_subject_id` CHAR(36) NOT NULL,
    `section_key` VARCHAR(100) NOT NULL,
    `heading` VARCHAR(500) NULL,
    `subheading` TEXT NULL,
    `body_json` JSON NULL,
    `media_id` CHAR(36) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `sub_subject_sections_owner_status_order_idx`(`sub_subject_id`, `status`, `display_order`),
    INDEX `sub_subject_sections_media_id_idx`(`media_id`),
    UNIQUE INDEX `sub_subject_sections_owner_key_key`(`sub_subject_id`, `section_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sub_subject_faqs` (
    `id` CHAR(36) NOT NULL,
    `sub_subject_id` CHAR(36) NOT NULL,
    `question` VARCHAR(1000) NOT NULL,
    `answer` LONGTEXT NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `sub_subject_faqs_owner_status_order_idx`(`sub_subject_id`, `status`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `sub_subject_content_sections` ADD CONSTRAINT `sub_subject_content_sections_sub_subject_id_fkey` FOREIGN KEY (`sub_subject_id`) REFERENCES `sub_subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sub_subject_content_sections` ADD CONSTRAINT `sub_subject_content_sections_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `sub_subject_faqs` ADD CONSTRAINT `sub_subject_faqs_sub_subject_id_fkey` FOREIGN KEY (`sub_subject_id`) REFERENCES `sub_subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
