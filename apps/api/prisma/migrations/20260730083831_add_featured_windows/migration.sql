-- AlterTable
ALTER TABLE `consultants` ADD COLUMN `featured_from` DATETIME(3) NULL,
    ADD COLUMN `featured_priority` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `featured_until` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `scholarships` ADD COLUMN `featured_from` DATETIME(3) NULL,
    ADD COLUMN `featured_priority` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `featured_until` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `universities` ADD COLUMN `featured_from` DATETIME(3) NULL,
    ADD COLUMN `featured_priority` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `featured_until` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `university_course_offerings` ADD COLUMN `featured_from` DATETIME(3) NULL,
    ADD COLUMN `featured_priority` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `featured_until` DATETIME(3) NULL;
