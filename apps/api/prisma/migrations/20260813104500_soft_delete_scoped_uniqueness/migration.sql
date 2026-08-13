-- Scope continent and country uniqueness to the live rows.
--
-- Both tables are soft-deleted, but `name`, `slug` and the code columns carried
-- plain unique indexes that counted deleted rows. Deleting a continent and
-- creating it again therefore failed permanently on the database constraint,
-- even though the service's own check (which filters `deleted_at IS NULL`)
-- passed. `deleted_key` is the discriminator that lets a single unique index
-- express "unique among live rows": it stays empty while the row is live, and
-- is set to the row's own id when the row is soft-deleted.
--
-- Additive and non-destructive: no row is deleted and no column is dropped.
-- The backfill below must run before the new indexes are created, so that any
-- already soft-deleted row releases the value it was holding.

ALTER TABLE `continents` ADD COLUMN `deleted_key` CHAR(36) NOT NULL DEFAULT '';
ALTER TABLE `countries` ADD COLUMN `deleted_key` CHAR(36) NOT NULL DEFAULT '';

UPDATE `continents` SET `deleted_key` = `id` WHERE `deleted_at` IS NOT NULL;
UPDATE `countries` SET `deleted_key` = `id` WHERE `deleted_at` IS NOT NULL;

DROP INDEX `continents_name_key` ON `continents`;
DROP INDEX `continents_slug_key` ON `continents`;
DROP INDEX `continents_code_key` ON `continents`;

DROP INDEX `countries_name_key` ON `countries`;
DROP INDEX `countries_slug_key` ON `countries`;
DROP INDEX `countries_iso2_code_key` ON `countries`;
DROP INDEX `countries_iso3_code_key` ON `countries`;

CREATE UNIQUE INDEX `continents_name_deleted_key` ON `continents`(`name`, `deleted_key`);
CREATE UNIQUE INDEX `continents_slug_deleted_key` ON `continents`(`slug`, `deleted_key`);
CREATE UNIQUE INDEX `continents_code_deleted_key` ON `continents`(`code`, `deleted_key`);

CREATE UNIQUE INDEX `countries_name_deleted_key` ON `countries`(`name`, `deleted_key`);
CREATE UNIQUE INDEX `countries_slug_deleted_key` ON `countries`(`slug`, `deleted_key`);
CREATE UNIQUE INDEX `countries_iso2_deleted_key` ON `countries`(`iso2_code`, `deleted_key`);
CREATE UNIQUE INDEX `countries_iso3_deleted_key` ON `countries`(`iso3_code`, `deleted_key`);
