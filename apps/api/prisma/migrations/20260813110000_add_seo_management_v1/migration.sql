-- Reusable read-time SEO rules. Individual seo_metadata rows remain untouched
-- and continue to take precedence over these templates.
CREATE TABLE `seo_bulk_templates` (
    `id` CHAR(36) NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `seo_title_template` VARCHAR(255) NULL,
    `meta_description_template` VARCHAR(500) NULL,
    `og_title_template` VARCHAR(255) NULL,
    `og_description_template` VARCHAR(500) NULL,
    `canonical_template` VARCHAR(2048) NULL,
    `robots_index` BOOLEAN NULL,
    `robots_follow` BOOLEAN NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `seo_bulk_templates_entity_type_key`(`entity_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
