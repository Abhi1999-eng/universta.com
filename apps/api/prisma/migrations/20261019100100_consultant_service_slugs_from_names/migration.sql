-- A service typed in the admin was slugged "<name>-<position>", so
-- "Visa documentation" became visa-documentation-1 beside the seeded
-- visa-documentation. The directory then offered the same service twice and
-- a ?service=visa-documentation link left out every consultant entered
-- through the admin. New services are now slugged from their name alone;
-- this gives the ones already saved the same slug.
--
-- A slug changes only when it is exactly the slug of its name plus a
-- trailing -<digits>, and only when no other service of the same consultant
-- holds, or would take, that slug. Language codes are left as they are.
-- Data only, and safe to run again: a second run finds nothing to change.
--
-- MySQL cannot read the table it is updating in a subquery, nor read a
-- temporary table twice in one statement, so the candidates are worked out
-- in a helper table first. It is created and filled in two statements
-- (not CREATE ... SELECT), which servers that enforce GTID consistency
-- accept, and its columns use the source table's collation so the joins
-- compare like with like.

DROP TABLE IF EXISTS `_service_slug_backfill`;

CREATE TABLE `_service_slug_backfill` (
  `id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `consultant_id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` VARCHAR(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `built` VARCHAR(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `_service_slug_backfill_consultant` (`consultant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `_service_slug_backfill` (`id`, `consultant_id`, `slug`, `built`)
SELECT
  s.`id`,
  s.`consultant_id`,
  s.`slug`,
  LEFT(
    TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(s.`name`), '[^a-z0-9]+', '-')),
    150
  )
FROM `consultant_services` AS s;

UPDATE `consultant_services` AS s
JOIN `_service_slug_backfill` AS t ON t.`id` = s.`id`
SET s.`slug` = t.`built`
WHERE t.`built` <> ''
  AND s.`slug` <> t.`built`
  AND s.`slug` REGEXP '-[0-9]+$'
  AND REGEXP_REPLACE(s.`slug`, '-[0-9]+$', '') = t.`built`
  AND NOT EXISTS (
    SELECT 1 FROM `_service_slug_backfill` AS o
    WHERE o.`consultant_id` = t.`consultant_id`
      AND o.`id` <> t.`id`
      AND (o.`slug` = t.`built` OR o.`built` = t.`built`)
  );

DROP TABLE `_service_slug_backfill`;
