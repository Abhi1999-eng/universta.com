-- The preceding migration can fail on existing databases whose default
-- collation differs from the established utf8mb4_unicode_ci Country tables.
-- Deployment recovers only that verified partial state with Prisma's official
-- migrate resolve command, then this idempotent completion creates the two
-- missing relation tables using matching identifier collations.
CREATE TABLE IF NOT EXISTS `country_popular_universities` (
  `country_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `university_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`country_id`, `university_id`),
  INDEX `country_popular_universities_university_id_idx` (`university_id`),
  CONSTRAINT `country_popular_universities_country_id_fkey`
    FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `country_popular_universities_university_id_fkey`
    FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `country_popular_courses` (
  `country_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `course_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`country_id`, `course_id`),
  INDEX `country_popular_courses_course_id_idx` (`course_id`),
  CONSTRAINT `country_popular_courses_country_id_fkey`
    FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `country_popular_courses_course_id_fkey`
    FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
