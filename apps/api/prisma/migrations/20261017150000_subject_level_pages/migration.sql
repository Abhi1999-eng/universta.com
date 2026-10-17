-- A study level's own page within a subject or one of its specializations
-- (/subjects/<subject>/<level>, /subjects/<subject>/<specialization>/<level>):
-- what an editor writes for it -- an intro, an admission note, a careers note
-- and its questions. Everything else on those pages is worked out from the
-- catalogue. A row is created the first time an editor saves the page, starts
-- as a draft, and is removed with its subject, specialization or study level.
-- Its SEO lives in seo_metadata under owner_type 'SUBJECT_LEVEL_PAGE' (no
-- foreign key there, so the services remove it).
--
-- `scope_key` makes one row per page a plain unique index: empty for a
-- subject's own page, the specialization's id for a specialization's.
-- `sub_subject_id` cannot carry the index itself, because MySQL never treats
-- two NULLs as equal -- the same reason continents have `deleted_key`.
CREATE TABLE `subject_level_pages` (
    `id` CHAR(36) NOT NULL,
    `subject_id` CHAR(36) NOT NULL,
    `sub_subject_id` CHAR(36) NULL,
    `scope_key` CHAR(36) NOT NULL DEFAULT '',
    `course_level_id` CHAR(36) NOT NULL,
    `intro` LONGTEXT NULL,
    `admission_note` LONGTEXT NULL,
    `careers_note` LONGTEXT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subject_level_pages_page_key`(`subject_id`, `scope_key`, `course_level_id`),
    INDEX `subject_level_pages_sub_subject_id_idx`(`sub_subject_id`),
    INDEX `subject_level_pages_course_level_id_idx`(`course_level_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Its questions, replaced whole on every save. Each has its own status, so an
-- editor can keep one written and hidden.
CREATE TABLE `subject_level_page_faqs` (
    `id` CHAR(36) NOT NULL,
    `page_id` CHAR(36) NOT NULL,
    `question` VARCHAR(1000) NOT NULL,
    `answer` LONGTEXT NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `subject_level_page_faqs_page_order_idx`(`page_id`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `subject_level_pages` ADD CONSTRAINT `subject_level_pages_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `subject_level_pages` ADD CONSTRAINT `subject_level_pages_sub_subject_id_fkey` FOREIGN KEY (`sub_subject_id`) REFERENCES `sub_subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `subject_level_pages` ADD CONSTRAINT `subject_level_pages_course_level_id_fkey` FOREIGN KEY (`course_level_id`) REFERENCES `course_levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `subject_level_page_faqs` ADD CONSTRAINT `subject_level_page_faqs_page_id_fkey` FOREIGN KEY (`page_id`) REFERENCES `subject_level_pages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
