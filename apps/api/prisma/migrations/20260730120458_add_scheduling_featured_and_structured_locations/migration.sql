-- AlterTable
ALTER TABLE `cities` ADD COLUMN `publish_ends_at` DATETIME(3) NULL,
    ADD COLUMN `publish_starts_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `consultant_locations` ADD COLUMN `city_id` CHAR(36) NULL,
    ADD COLUMN `state_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `consultants` ADD COLUMN `publish_ends_at` DATETIME(3) NULL,
    ADD COLUMN `publish_starts_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `courses` ADD COLUMN `featured_from` DATETIME(3) NULL,
    ADD COLUMN `featured_priority` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `featured_until` DATETIME(3) NULL,
    ADD COLUMN `publish_ends_at` DATETIME(3) NULL,
    ADD COLUMN `publish_starts_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `events` ADD COLUMN `city_id` CHAR(36) NULL,
    ADD COLUMN `country_id` CHAR(36) NULL,
    ADD COLUMN `featured_from` DATETIME(3) NULL,
    ADD COLUMN `featured_priority` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `featured_until` DATETIME(3) NULL,
    ADD COLUMN `is_featured` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `publish_ends_at` DATETIME(3) NULL,
    ADD COLUMN `publish_starts_at` DATETIME(3) NULL,
    ADD COLUMN `state_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `jobs` ADD COLUMN `city_id` CHAR(36) NULL,
    ADD COLUMN `country_id` CHAR(36) NULL,
    ADD COLUMN `featured_from` DATETIME(3) NULL,
    ADD COLUMN `featured_priority` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `featured_until` DATETIME(3) NULL,
    ADD COLUMN `is_featured` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `publish_ends_at` DATETIME(3) NULL,
    ADD COLUMN `publish_starts_at` DATETIME(3) NULL,
    ADD COLUMN `state_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `scholarships` ADD COLUMN `publish_ends_at` DATETIME(3) NULL,
    ADD COLUMN `publish_starts_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `success_stories` ADD COLUMN `publish_ends_at` DATETIME(3) NULL,
    ADD COLUMN `publish_starts_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `testimonials` ADD COLUMN `publish_ends_at` DATETIME(3) NULL,
    ADD COLUMN `publish_starts_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `universities` ADD COLUMN `publish_ends_at` DATETIME(3) NULL,
    ADD COLUMN `publish_starts_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `university_campuses` ADD COLUMN `city_id` CHAR(36) NULL,
    ADD COLUMN `state_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `university_course_offerings` ADD COLUMN `publish_ends_at` DATETIME(3) NULL,
    ADD COLUMN `publish_starts_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `consultant_locations_city_id_idx` ON `consultant_locations`(`city_id`);

-- CreateIndex
CREATE INDEX `consultant_locations_state_id_idx` ON `consultant_locations`(`state_id`);

-- CreateIndex
CREATE INDEX `events_city_id_idx` ON `events`(`city_id`);

-- CreateIndex
CREATE INDEX `events_state_id_idx` ON `events`(`state_id`);

-- CreateIndex
CREATE INDEX `events_country_id_idx` ON `events`(`country_id`);

-- CreateIndex
CREATE INDEX `jobs_city_id_idx` ON `jobs`(`city_id`);

-- CreateIndex
CREATE INDEX `jobs_state_id_idx` ON `jobs`(`state_id`);

-- CreateIndex
CREATE INDEX `jobs_country_id_idx` ON `jobs`(`country_id`);

-- CreateIndex
CREATE INDEX `university_campuses_city_id_idx` ON `university_campuses`(`city_id`);

-- CreateIndex
CREATE INDEX `university_campuses_state_id_idx` ON `university_campuses`(`state_id`);

-- AddForeignKey
ALTER TABLE `university_campuses` ADD CONSTRAINT `university_campuses_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `university_campuses` ADD CONSTRAINT `university_campuses_state_id_fkey` FOREIGN KEY (`state_id`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultant_locations` ADD CONSTRAINT `consultant_locations_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultant_locations` ADD CONSTRAINT `consultant_locations_state_id_fkey` FOREIGN KEY (`state_id`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_state_id_fkey` FOREIGN KEY (`state_id`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_state_id_fkey` FOREIGN KEY (`state_id`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
