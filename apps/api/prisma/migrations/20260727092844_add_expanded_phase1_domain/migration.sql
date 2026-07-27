-- CreateTable
CREATE TABLE `universities` (
    `id` CHAR(36) NOT NULL,
    `country_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `institution_type` VARCHAR(80) NULL,
    `short_description` VARCHAR(1000) NULL,
    `overview` LONGTEXT NULL,
    `featured_media_id` CHAR(36) NULL,
    `source_reference` VARCHAR(2048) NULL,
    `verified_at` DATETIME(3) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `universities_slug_key`(`slug`),
    INDEX `universities_country_id_status_display_order_idx`(`country_id`, `status`, `display_order`),
    INDEX `universities_status_institution_type_is_featured_idx`(`status`, `institution_type`, `is_featured`),
    UNIQUE INDEX `universities_country_id_name_key`(`country_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `university_campuses` (
    `id` CHAR(36) NOT NULL,
    `university_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `city` VARCHAR(150) NULL,
    `state` VARCHAR(150) NULL,
    `address` TEXT NULL,
    `overview` TEXT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `university_campuses_university_id_status_display_order_idx`(`university_id`, `status`, `display_order`),
    UNIQUE INDEX `university_campuses_university_id_slug_key`(`university_id`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `university_accreditations` (
    `id` CHAR(36) NOT NULL,
    `university_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `accreditor` VARCHAR(255) NULL,
    `reference_url` VARCHAR(2048) NULL,
    `verified_at` DATETIME(3) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `university_accreditations_university_id_status_display_order_idx`(`university_id`, `status`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `university_course_offerings` (
    `id` CHAR(36) NOT NULL,
    `university_id` CHAR(36) NOT NULL,
    `generic_course_id` CHAR(36) NOT NULL,
    `campus_id` CHAR(36) NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `course_code` VARCHAR(100) NULL,
    `short_description` VARCHAR(1000) NULL,
    `overview` LONGTEXT NULL,
    `course_level_id` CHAR(36) NULL,
    `study_mode` VARCHAR(50) NULL,
    `duration_min` DECIMAL(6, 2) NULL,
    `duration_max` DECIMAL(6, 2) NULL,
    `duration_unit` VARCHAR(30) NULL,
    `tuition_min` DECIMAL(12, 2) NULL,
    `tuition_max` DECIMAL(12, 2) NULL,
    `currency_code` CHAR(3) NULL,
    `tuition_period` VARCHAR(30) NULL,
    `application_url` VARCHAR(2048) NULL,
    `source_reference` VARCHAR(2048) NULL,
    `verified_at` DATETIME(3) NULL,
    `featured_media_id` CHAR(36) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `university_course_offerings_slug_key`(`slug`),
    INDEX `university_course_offerings_university_id_status_display_ord_idx`(`university_id`, `status`, `display_order`),
    INDEX `university_course_offerings_generic_course_id_status_idx`(`generic_course_id`, `status`),
    INDEX `university_course_offerings_campus_id_idx`(`campus_id`),
    INDEX `university_course_offerings_course_level_id_idx`(`course_level_id`),
    UNIQUE INDEX `university_course_offerings_university_id_name_key`(`university_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `university_course_intakes` (
    `id` CHAR(36) NOT NULL,
    `offering_id` CHAR(36) NOT NULL,
    `intake_id` CHAR(36) NOT NULL,
    `deadline` DATE NULL,
    `notes` VARCHAR(500) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `university_course_intakes_intake_id_status_idx`(`intake_id`, `status`),
    UNIQUE INDEX `university_course_intakes_offering_id_intake_id_key`(`offering_id`, `intake_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `university_course_requirements` (
    `id` CHAR(36) NOT NULL,
    `offering_id` CHAR(36) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `minimum_score` DECIMAL(7, 2) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `university_course_requirements_offering_id_status_display_or_idx`(`offering_id`, `status`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scholarship_providers` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `website_url` VARCHAR(2048) NULL,
    `source_reference` VARCHAR(2048) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `scholarship_providers_name_key`(`name`),
    UNIQUE INDEX `scholarship_providers_slug_key`(`slug`),
    INDEX `scholarship_providers_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scholarships` (
    `id` CHAR(36) NOT NULL,
    `provider_id` CHAR(36) NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `summary` VARCHAR(1000) NULL,
    `description` LONGTEXT NULL,
    `benefit_type` VARCHAR(80) NULL,
    `amount` DECIMAL(12, 2) NULL,
    `currency_code` CHAR(3) NULL,
    `eligibility` LONGTEXT NULL,
    `deadline` DATE NULL,
    `application_url` VARCHAR(2048) NULL,
    `source_reference` VARCHAR(2048) NULL,
    `verified_at` DATETIME(3) NULL,
    `featured_media_id` CHAR(36) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `scholarships_slug_key`(`slug`),
    INDEX `scholarships_provider_id_status_display_order_idx`(`provider_id`, `status`, `display_order`),
    INDEX `scholarships_status_deadline_idx`(`status`, `deadline`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scholarship_countries` (
    `scholarship_id` CHAR(36) NOT NULL,
    `country_id` CHAR(36) NOT NULL,

    INDEX `scholarship_countries_country_id_idx`(`country_id`),
    PRIMARY KEY (`scholarship_id`, `country_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scholarship_universities` (
    `scholarship_id` CHAR(36) NOT NULL,
    `university_id` CHAR(36) NOT NULL,

    INDEX `scholarship_universities_university_id_idx`(`university_id`),
    PRIMARY KEY (`scholarship_id`, `university_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scholarship_university_course_offerings` (
    `scholarship_id` CHAR(36) NOT NULL,
    `offering_id` CHAR(36) NOT NULL,

    INDEX `scholarship_university_course_offerings_offering_id_idx`(`offering_id`),
    PRIMARY KEY (`scholarship_id`, `offering_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consultants` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `short_description` VARCHAR(1000) NULL,
    `description` LONGTEXT NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `website_url` VARCHAR(2048) NULL,
    `verification_status` VARCHAR(30) NOT NULL DEFAULT 'UNVERIFIED',
    `source_reference` VARCHAR(2048) NULL,
    `verified_at` DATETIME(3) NULL,
    `featured_media_id` CHAR(36) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `consultants_slug_key`(`slug`),
    INDEX `consultants_status_verification_status_display_order_idx`(`status`, `verification_status`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consultant_locations` (
    `id` CHAR(36) NOT NULL,
    `country_id` CHAR(36) NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `city` VARCHAR(150) NOT NULL,
    `state` VARCHAR(150) NULL,
    `overview` TEXT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `consultant_locations_slug_key`(`slug`),
    INDEX `consultant_locations_country_id_status_idx`(`country_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consultant_location_map` (
    `consultant_id` CHAR(36) NOT NULL,
    `location_id` CHAR(36) NOT NULL,
    `address` TEXT NULL,

    INDEX `consultant_location_map_location_id_idx`(`location_id`),
    PRIMARY KEY (`consultant_id`, `location_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consultant_services` (
    `id` CHAR(36) NOT NULL,
    `consultant_id` CHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(150) NOT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `consultant_services_slug_idx`(`slug`),
    UNIQUE INDEX `consultant_services_consultant_id_slug_key`(`consultant_id`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consultant_countries` (
    `consultant_id` CHAR(36) NOT NULL,
    `country_id` CHAR(36) NOT NULL,

    INDEX `consultant_countries_country_id_idx`(`country_id`),
    PRIMARY KEY (`consultant_id`, `country_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consultant_languages` (
    `id` CHAR(36) NOT NULL,
    `consultant_id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(20) NULL,

    INDEX `consultant_languages_name_idx`(`name`),
    UNIQUE INDEX `consultant_languages_consultant_id_name_key`(`consultant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact_inquiries` (
    `id` CHAR(36) NOT NULL,
    `inquiry_number` VARCHAR(50) NOT NULL,
    `full_name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone_number` VARCHAR(50) NULL,
    `subject` VARCHAR(255) NULL,
    `message` TEXT NOT NULL,
    `privacy_consent` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(30) NOT NULL DEFAULT 'NEW',
    `converted_lead_id` CHAR(36) NULL,
    `converted_by_user_id` CHAR(36) NULL,
    `converted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `contact_inquiries_inquiry_number_key`(`inquiry_number`),
    UNIQUE INDEX `contact_inquiries_converted_lead_id_key`(`converted_lead_id`),
    INDEX `contact_inquiries_status_created_at_idx`(`status`, `created_at`),
    INDEX `contact_inquiries_email_created_at_idx`(`email`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `success_stories` (
    `id` CHAR(36) NOT NULL,
    `country_id` CHAR(36) NULL,
    `university_id` CHAR(36) NULL,
    `offering_id` CHAR(36) NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `journey` LONGTEXT NOT NULL,
    `attribution` VARCHAR(255) NULL,
    `attribution_note` VARCHAR(500) NULL,
    `featured_media_id` CHAR(36) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `success_stories_slug_key`(`slug`),
    INDEX `success_stories_status_display_order_idx`(`status`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `testimonials` (
    `id` CHAR(36) NOT NULL,
    `university_id` CHAR(36) NULL,
    `offering_id` CHAR(36) NULL,
    `quote` TEXT NOT NULL,
    `attribution` VARCHAR(255) NULL,
    `attribution_note` VARCHAR(500) NULL,
    `image_media_id` CHAR(36) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `testimonials_status_display_order_idx`(`status`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs` (
    `id` CHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `department` VARCHAR(150) NULL,
    `employment_type` VARCHAR(80) NULL,
    `location` VARCHAR(255) NULL,
    `remote_status` VARCHAR(50) NULL,
    `summary` VARCHAR(1000) NULL,
    `description` LONGTEXT NULL,
    `responsibilities` LONGTEXT NULL,
    `qualifications` LONGTEXT NULL,
    `application_url` VARCHAR(2048) NULL,
    `application_email` VARCHAR(255) NULL,
    `published_date` DATE NULL,
    `expiry_date` DATE NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `jobs_slug_key`(`slug`),
    INDEX `jobs_status_expiry_date_display_order_idx`(`status`, `expiry_date`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `events` (
    `id` CHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `summary` VARCHAR(1000) NULL,
    `description` LONGTEXT NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NULL,
    `timezone` VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    `event_type` VARCHAR(30) NOT NULL DEFAULT 'OFFLINE',
    `venue` VARCHAR(500) NULL,
    `online_url` VARCHAR(2048) NULL,
    `speakers_json` JSON NULL,
    `registration_url` VARCHAR(2048) NULL,
    `featured_media_id` CHAR(36) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `events_slug_key`(`slug`),
    INDEX `events_status_starts_at_display_order_idx`(`status`, `starts_at`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `universities` ADD CONSTRAINT `universities_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `university_campuses` ADD CONSTRAINT `university_campuses_university_id_fkey` FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `university_accreditations` ADD CONSTRAINT `university_accreditations_university_id_fkey` FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `university_course_offerings` ADD CONSTRAINT `university_course_offerings_university_id_fkey` FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `university_course_offerings` ADD CONSTRAINT `university_course_offerings_generic_course_id_fkey` FOREIGN KEY (`generic_course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `university_course_offerings` ADD CONSTRAINT `university_course_offerings_campus_id_fkey` FOREIGN KEY (`campus_id`) REFERENCES `university_campuses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `university_course_offerings` ADD CONSTRAINT `university_course_offerings_course_level_id_fkey` FOREIGN KEY (`course_level_id`) REFERENCES `course_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `university_course_intakes` ADD CONSTRAINT `university_course_intakes_offering_id_fkey` FOREIGN KEY (`offering_id`) REFERENCES `university_course_offerings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `university_course_intakes` ADD CONSTRAINT `university_course_intakes_intake_id_fkey` FOREIGN KEY (`intake_id`) REFERENCES `intakes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `university_course_requirements` ADD CONSTRAINT `university_course_requirements_offering_id_fkey` FOREIGN KEY (`offering_id`) REFERENCES `university_course_offerings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scholarships` ADD CONSTRAINT `scholarships_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `scholarship_providers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scholarship_countries` ADD CONSTRAINT `scholarship_countries_scholarship_id_fkey` FOREIGN KEY (`scholarship_id`) REFERENCES `scholarships`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scholarship_countries` ADD CONSTRAINT `scholarship_countries_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scholarship_universities` ADD CONSTRAINT `scholarship_universities_scholarship_id_fkey` FOREIGN KEY (`scholarship_id`) REFERENCES `scholarships`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scholarship_universities` ADD CONSTRAINT `scholarship_universities_university_id_fkey` FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scholarship_university_course_offerings` ADD CONSTRAINT `scholarship_university_course_offerings_scholarship_id_fkey` FOREIGN KEY (`scholarship_id`) REFERENCES `scholarships`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scholarship_university_course_offerings` ADD CONSTRAINT `scholarship_university_course_offerings_offering_id_fkey` FOREIGN KEY (`offering_id`) REFERENCES `university_course_offerings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultant_locations` ADD CONSTRAINT `consultant_locations_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultant_location_map` ADD CONSTRAINT `consultant_location_map_consultant_id_fkey` FOREIGN KEY (`consultant_id`) REFERENCES `consultants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultant_location_map` ADD CONSTRAINT `consultant_location_map_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `consultant_locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultant_services` ADD CONSTRAINT `consultant_services_consultant_id_fkey` FOREIGN KEY (`consultant_id`) REFERENCES `consultants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultant_countries` ADD CONSTRAINT `consultant_countries_consultant_id_fkey` FOREIGN KEY (`consultant_id`) REFERENCES `consultants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultant_countries` ADD CONSTRAINT `consultant_countries_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultant_languages` ADD CONSTRAINT `consultant_languages_consultant_id_fkey` FOREIGN KEY (`consultant_id`) REFERENCES `consultants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_inquiries` ADD CONSTRAINT `contact_inquiries_converted_lead_id_fkey` FOREIGN KEY (`converted_lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_inquiries` ADD CONSTRAINT `contact_inquiries_converted_by_user_id_fkey` FOREIGN KEY (`converted_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `success_stories` ADD CONSTRAINT `success_stories_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `success_stories` ADD CONSTRAINT `success_stories_university_id_fkey` FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `success_stories` ADD CONSTRAINT `success_stories_offering_id_fkey` FOREIGN KEY (`offering_id`) REFERENCES `university_course_offerings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `testimonials` ADD CONSTRAINT `testimonials_university_id_fkey` FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `testimonials` ADD CONSTRAINT `testimonials_offering_id_fkey` FOREIGN KEY (`offering_id`) REFERENCES `university_course_offerings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `countries` RENAME INDEX `countries_name_page_heading_short_description_fulltext` TO `countries_name_page_heading_short_description_idx`;

-- RenameIndex
ALTER TABLE `courses` RENAME INDEX `courses_name_short_description_overview_fulltext` TO `courses_name_short_description_overview_idx`;
