-- Country keeps editorial configuration; factual tuition/count/ranking values
-- are derived from Universities and UniversityCourseOfferings at read time.
ALTER TABLE `countries`
  ADD COLUMN `feature_codes` JSON NULL,
  ADD COLUMN `accepted_tests` JSON NULL,
  ADD COLUMN `intake_months` JSON NULL,
  ADD COLUMN `post_study_work_permit_months` INT NULL;

ALTER TABLE `universities`
  ADD COLUMN `qs_ranking` INT NULL;

-- Preserve useful legacy Country configuration without copying any tuition,
-- statistics, sources, or institution-level requirements into the new model.
UPDATE `countries` AS `country`
LEFT JOIN `country_work_profiles` AS `work`
  ON `work`.`country_id` = `country`.`id`
LEFT JOIN `country_language_requirements` AS `language`
  ON `language`.`country_id` = `country`.`id`
SET
  `country`.`feature_codes` = JSON_MERGE_PRESERVE(
    IF(`work`.`part_time_allowed` = 1, JSON_ARRAY('PART_TIME_ALLOWED'), JSON_ARRAY()),
    IF(`work`.`post_study_work_available` = 1, JSON_ARRAY('POST_STUDY_WORK_AVAILABLE'), JSON_ARRAY()),
    IF(`language`.`language_waiver_available` = 1, JSON_ARRAY('LANGUAGE_WAIVER'), JSON_ARRAY())
  ),
  `country`.`post_study_work_permit_months` = COALESCE(
    `work`.`post_study_work_max_months`,
    `work`.`post_study_work_min_months`
  )
WHERE `work`.`country_id` IS NOT NULL OR `language`.`country_id` IS NOT NULL;

CREATE INDEX `universities_country_id_qs_ranking_idx`
  ON `universities`(`country_id`, `qs_ranking`);

CREATE TABLE `country_popular_universities` (
  `country_id` CHAR(36) NOT NULL,
  `university_id` CHAR(36) NOT NULL,
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
);

CREATE TABLE `country_popular_courses` (
  `country_id` CHAR(36) NOT NULL,
  `course_id` CHAR(36) NOT NULL,
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
);
