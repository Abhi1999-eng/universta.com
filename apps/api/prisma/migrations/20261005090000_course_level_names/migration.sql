-- The study levels the client asked for, by the names the client uses.
--
-- Subject and destination pages now file their courses under study levels,
-- and the client named the levels a student should see there: Foundation
-- Program, Pathway Program, Bachelor's, Master's, MBA, PhD -- in that order.
-- The catalogue had no Foundation or Pathway level, called the other four
-- Undergraduate, Postgraduate, Master of Business Administration and Doctor
-- of Philosophy, and ordered Certificate and Diploma ahead of all of them.
--
-- A migration rather than a seed change, because the seed never rewrites a
-- level that exists (it upserts on the code with nothing to update), and
-- because this has to happen once per database: run on every deploy it
-- would undo whatever an editor renamed afterwards in Admin, Course levels,
-- which is where names and order belong from here on.
--
-- Codes do not change. Courses, bulk sheets, the course search (?level=UG)
-- and the counselling form all refer to a level by its code.
--
-- Nothing an editor has already changed is touched: each rename only applies
-- while the level still has the name the seed gave it, and is skipped if
-- another level already carries the new name (names are unique, and a clash
-- would stop the deploy). The new order only applies to a level whose order
-- is still the seeded one.

-- Two new levels. INSERT IGNORE: a level with either the code or the name
-- already exists, so leave it as it is.
INSERT IGNORE INTO `course_levels`
  (`id`, `code`, `name`, `education_order`, `display_order`, `status`, `created_at`, `updated_at`)
VALUES
  (UUID(), 'FOUNDATION', 'Foundation Program', 1, 1, 'ACTIVE', NOW(3), NOW(3)),
  (UUID(), 'PATHWAY', 'Pathway Program', 2, 2, 'ACTIVE', NOW(3), NOW(3));

-- The four renames. The self-join finds a level that already has the new
-- name; only when there is none does the rename happen.
UPDATE `course_levels` l
LEFT JOIN `course_levels` taken ON taken.`name` = 'Bachelor''s'
SET l.`name` = 'Bachelor''s', l.`updated_at` = NOW(3)
WHERE l.`code` = 'UG' AND l.`name` = 'Undergraduate' AND taken.`id` IS NULL;

UPDATE `course_levels` l
LEFT JOIN `course_levels` taken ON taken.`name` = 'Master''s'
SET l.`name` = 'Master''s', l.`updated_at` = NOW(3)
WHERE l.`code` = 'PG' AND l.`name` = 'Postgraduate' AND taken.`id` IS NULL;

UPDATE `course_levels` l
LEFT JOIN `course_levels` taken ON taken.`name` = 'MBA'
SET l.`name` = 'MBA', l.`updated_at` = NOW(3)
WHERE l.`code` = 'MBA' AND l.`name` = 'Master of Business Administration' AND taken.`id` IS NULL;

UPDATE `course_levels` l
LEFT JOIN `course_levels` taken ON taken.`name` = 'PhD'
SET l.`name` = 'PhD', l.`updated_at` = NOW(3)
WHERE l.`code` = 'PHD' AND l.`name` = 'Doctor of Philosophy' AND taken.`id` IS NULL;

-- The order: the client's six first, as listed, then the three other
-- qualifications. `display_order` follows it too, so the course search's
-- level filter lists them the same way instead of alphabetically.
UPDATE `course_levels`
SET
  `education_order` = CASE `code`
    WHEN 'UG' THEN 3 WHEN 'PG' THEN 4 WHEN 'MBA' THEN 5 WHEN 'PHD' THEN 6
    WHEN 'DIPLOMA' THEN 7 WHEN 'PGDM' THEN 8 WHEN 'CERTIFICATE' THEN 9
  END,
  `display_order` = CASE `code`
    WHEN 'UG' THEN 3 WHEN 'PG' THEN 4 WHEN 'MBA' THEN 5 WHEN 'PHD' THEN 6
    WHEN 'DIPLOMA' THEN 7 WHEN 'PGDM' THEN 8 WHEN 'CERTIFICATE' THEN 9
  END,
  `updated_at` = NOW(3)
WHERE (`code`, `education_order`, `display_order`) IN (
  ('CERTIFICATE', 0, 0), ('DIPLOMA', 1, 0), ('UG', 2, 0), ('PGDM', 3, 0),
  ('PG', 4, 0), ('MBA', 5, 0), ('PHD', 6, 0)
);
