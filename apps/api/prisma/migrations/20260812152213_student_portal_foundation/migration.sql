-- Phase 2-A student domain. Additive only: no Phase 1 table is dropped,
-- renamed or altered destructively.
--
-- Prisma's diff also proposed dropping `lead_consultant_assignments`, because
-- that table is created by migration 20260808174000 but its model is absent
-- from schema.prisma on main. That inconsistency predates this branch and
-- dropping the table is not this change's decision to make, so the statements
-- are deliberately left out.

-- CreateTable
CREATE TABLE `email_verification_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `requested_ip` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `email_verification_tokens_token_hash_key`(`token_hash`),
    INDEX `email_verification_tokens_user_id_idx`(`user_id`),
    INDEX `email_verification_tokens_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_profiles` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `date_of_birth` DATE NULL,
    `gender` VARCHAR(30) NULL,
    `nationality_country_id` CHAR(36) NULL,
    `current_country_id` CHAR(36) NULL,
    `current_city_text` VARCHAR(150) NULL,
    `address` VARCHAR(500) NULL,
    `postal_code` VARCHAR(20) NULL,
    `preferred_subject_id` CHAR(36) NULL,
    `preferred_course_level_id` CHAR(36) NULL,
    `preferred_intake_id` CHAR(36) NULL,
    `budget_min` DECIMAL(12, 2) NULL,
    `budget_max` DECIMAL(12, 2) NULL,
    `budget_currency` VARCHAR(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `student_profiles_user_id_key`(`user_id`),
    INDEX `student_profiles_nationality_country_id_idx`(`nationality_country_id`),
    INDEX `student_profiles_current_country_id_idx`(`current_country_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_preferred_countries` (
    `student_profile_id` CHAR(36) NOT NULL,
    `country_id` CHAR(36) NOT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `student_preferred_countries_country_id_idx`(`country_id`),
    PRIMARY KEY (`student_profile_id`, `country_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_academic_records` (
    `id` CHAR(36) NOT NULL,
    `student_profile_id` CHAR(36) NOT NULL,
    `qualification_name` VARCHAR(200) NOT NULL,
    `qualification_level` VARCHAR(60) NULL,
    `institution_name` VARCHAR(200) NOT NULL,
    `board_or_university` VARCHAR(200) NULL,
    `country_id` CHAR(36) NULL,
    `specialization` VARCHAR(200) NULL,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `currently_studying` BOOLEAN NOT NULL DEFAULT false,
    `percentage` DECIMAL(5, 2) NULL,
    `gpa` DECIMAL(5, 2) NULL,
    `gpa_scale` DECIMAL(5, 2) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `student_academic_records_student_profile_id_idx`(`student_profile_id`),
    INDEX `student_academic_records_country_id_idx`(`country_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_work_experiences` (
    `id` CHAR(36) NOT NULL,
    `student_profile_id` CHAR(36) NOT NULL,
    `company_name` VARCHAR(200) NOT NULL,
    `job_title` VARCHAR(200) NOT NULL,
    `employment_type` VARCHAR(40) NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `currently_working` BOOLEAN NOT NULL DEFAULT false,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `student_work_experiences_student_profile_id_idx`(`student_profile_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_english_tests` (
    `id` CHAR(36) NOT NULL,
    `student_profile_id` CHAR(36) NOT NULL,
    `test_type` VARCHAR(30) NOT NULL,
    `test_date` DATE NULL,
    `overall_score` DECIMAL(5, 2) NOT NULL,
    `component_scores` JSON NULL,
    `expiry_date` DATE NULL,
    `result_media_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `student_english_tests_student_profile_id_idx`(`student_profile_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_passports` (
    `id` CHAR(36) NOT NULL,
    `student_profile_id` CHAR(36) NOT NULL,
    `passport_number` VARCHAR(60) NOT NULL,
    `issuing_country_id` CHAR(36) NULL,
    `issue_date` DATE NULL,
    `expiry_date` DATE NULL,
    `passport_media_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `student_passports_student_profile_id_key`(`student_profile_id`),
    INDEX `student_passports_issuing_country_id_idx`(`issuing_country_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_documents` (
    `id` CHAR(36) NOT NULL,
    `student_profile_id` CHAR(36) NOT NULL,
    `media_asset_id` CHAR(36) NOT NULL,
    `document_type` VARCHAR(40) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `student_documents_student_profile_id_idx`(`student_profile_id`),
    INDEX `student_documents_student_profile_id_document_type_idx`(`student_profile_id`, `document_type`),
    INDEX `student_documents_media_asset_id_idx`(`media_asset_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `email_verification_tokens` ADD CONSTRAINT `email_verification_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_profiles` ADD CONSTRAINT `student_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_profiles` ADD CONSTRAINT `student_profiles_nationality_country_id_fkey` FOREIGN KEY (`nationality_country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_profiles` ADD CONSTRAINT `student_profiles_current_country_id_fkey` FOREIGN KEY (`current_country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_profiles` ADD CONSTRAINT `student_profiles_preferred_subject_id_fkey` FOREIGN KEY (`preferred_subject_id`) REFERENCES `subjects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_profiles` ADD CONSTRAINT `student_profiles_preferred_course_level_id_fkey` FOREIGN KEY (`preferred_course_level_id`) REFERENCES `course_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_profiles` ADD CONSTRAINT `student_profiles_preferred_intake_id_fkey` FOREIGN KEY (`preferred_intake_id`) REFERENCES `intakes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_preferred_countries` ADD CONSTRAINT `student_preferred_countries_student_profile_id_fkey` FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_preferred_countries` ADD CONSTRAINT `student_preferred_countries_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_academic_records` ADD CONSTRAINT `student_academic_records_student_profile_id_fkey` FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_academic_records` ADD CONSTRAINT `student_academic_records_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_work_experiences` ADD CONSTRAINT `student_work_experiences_student_profile_id_fkey` FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_english_tests` ADD CONSTRAINT `student_english_tests_student_profile_id_fkey` FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_english_tests` ADD CONSTRAINT `student_english_tests_result_media_id_fkey` FOREIGN KEY (`result_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_passports` ADD CONSTRAINT `student_passports_student_profile_id_fkey` FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_passports` ADD CONSTRAINT `student_passports_issuing_country_id_fkey` FOREIGN KEY (`issuing_country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_passports` ADD CONSTRAINT `student_passports_passport_media_id_fkey` FOREIGN KEY (`passport_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_documents` ADD CONSTRAINT `student_documents_student_profile_id_fkey` FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_documents` ADD CONSTRAINT `student_documents_media_asset_id_fkey` FOREIGN KEY (`media_asset_id`) REFERENCES `media_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
