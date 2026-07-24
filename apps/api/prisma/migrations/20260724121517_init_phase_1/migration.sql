-- CreateTable
CREATE TABLE `roles` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `is_system_role` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NULL,
    `phone_country_code` VARCHAR(10) NULL,
    `phone_number` VARCHAR(30) NULL,
    `avatar_media_id` CHAR(36) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `email_verified_at` DATETIME(3) NULL,
    `password_changed_at` DATETIME(3) NULL,
    `failed_login_attempts` INTEGER NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `last_login_ip` VARCHAR(45) NULL,
    `timezone` VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    `locale` VARCHAR(20) NOT NULL DEFAULT 'en-IN',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_avatar_media_id_idx`(`avatar_media_id`),
    INDEX `users_status_deleted_at_idx`(`status`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `role_id` CHAR(36) NOT NULL,
    `assigned_by_user_id` CHAR(36) NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_roles_user_id_idx`(`user_id`),
    INDEX `user_roles_role_id_idx`(`role_id`),
    INDEX `user_roles_assigned_by_user_id_idx`(`assigned_by_user_id`),
    UNIQUE INDEX `user_roles_user_id_role_id_key`(`user_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `revocation_reason` VARCHAR(255) NULL,
    `replaced_by_token_id` CHAR(36) NULL,
    `created_ip` VARCHAR(45) NULL,
    `user_agent` VARCHAR(1000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    INDEX `refresh_tokens_replaced_by_token_id_idx`(`replaced_by_token_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `requested_ip` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_hash_key`(`token_hash`),
    INDEX `password_reset_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_attempts` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `attempted_email` VARCHAR(255) NOT NULL,
    `was_successful` BOOLEAN NOT NULL,
    `failure_reason` VARCHAR(255) NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(1000) NULL,
    `request_id` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_attempts_user_id_idx`(`user_id`),
    INDEX `login_attempts_attempted_email_created_at_idx`(`attempted_email`, `created_at`),
    INDEX `login_attempts_ip_address_created_at_idx`(`ip_address`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `module` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(100) NOT NULL,
    `entity_id` CHAR(36) NULL,
    `action` VARCHAR(50) NOT NULL,
    `old_values` JSON NULL,
    `new_values` JSON NULL,
    `description` VARCHAR(1000) NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(1000) NULL,
    `request_id` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `audit_logs_module_action_created_at_idx`(`module`, `action`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `media_assets` (
    `id` CHAR(36) NOT NULL,
    `storage_provider` VARCHAR(30) NOT NULL DEFAULT 'LOCAL',
    `bucket_name` VARCHAR(255) NULL,
    `object_key` VARCHAR(1000) NOT NULL,
    `public_url` VARCHAR(2048) NOT NULL,
    `original_file_name` VARCHAR(500) NOT NULL,
    `stored_file_name` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(150) NOT NULL,
    `file_extension` VARCHAR(20) NULL,
    `file_size_bytes` BIGINT NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `duration_seconds` INTEGER NULL,
    `checksum` VARCHAR(128) NULL,
    `title` VARCHAR(255) NULL,
    `alt_text` VARCHAR(500) NULL,
    `caption` TEXT NULL,
    `folder` VARCHAR(255) NULL,
    `media_type` VARCHAR(30) NOT NULL DEFAULT 'IMAGE',
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `uploaded_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `media_assets_uploaded_by_user_id_idx`(`uploaded_by_user_id`),
    INDEX `media_assets_folder_status_idx`(`folder`, `status`),
    INDEX `media_assets_checksum_idx`(`checksum`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_settings` (
    `id` CHAR(36) NOT NULL,
    `setting_key` VARCHAR(150) NOT NULL,
    `setting_group` VARCHAR(100) NOT NULL,
    `value_type` VARCHAR(30) NOT NULL,
    `value_json` JSON NULL,
    `description` VARCHAR(500) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `updated_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `site_settings_setting_key_key`(`setting_key`),
    INDEX `site_settings_updated_by_user_id_idx`(`updated_by_user_id`),
    INDEX `site_settings_setting_group_is_public_idx`(`setting_group`, `is_public`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feature_flags` (
    `id` CHAR(36) NOT NULL,
    `flag_key` VARCHAR(150) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` VARCHAR(500) NULL,
    `is_enabled` BOOLEAN NOT NULL DEFAULT false,
    `environment` VARCHAR(30) NOT NULL DEFAULT 'ALL',
    `configuration_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `feature_flags_flag_key_key`(`flag_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pages` (
    `id` CHAR(36) NOT NULL,
    `page_type` VARCHAR(50) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `short_title` VARCHAR(150) NULL,
    `slug` VARCHAR(255) NOT NULL,
    `layout_key` VARCHAR(100) NULL,
    `short_description` VARCHAR(1000) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `is_homepage` BOOLEAN NOT NULL DEFAULT false,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `updated_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `pages_slug_key`(`slug`),
    INDEX `pages_created_by_user_id_idx`(`created_by_user_id`),
    INDEX `pages_updated_by_user_id_idx`(`updated_by_user_id`),
    INDEX `pages_page_type_status_display_order_idx`(`page_type`, `status`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `page_sections` (
    `id` CHAR(36) NOT NULL,
    `page_id` CHAR(36) NOT NULL,
    `section_key` VARCHAR(100) NOT NULL,
    `section_type` VARCHAR(100) NOT NULL,
    `eyebrow` VARCHAR(255) NULL,
    `heading` VARCHAR(500) NULL,
    `subheading` TEXT NULL,
    `body_json` JSON NULL,
    `media_id` CHAR(36) NULL,
    `background_media_id` CHAR(36) NULL,
    `cta_primary_label` VARCHAR(100) NULL,
    `cta_primary_url` VARCHAR(1000) NULL,
    `cta_secondary_label` VARCHAR(100) NULL,
    `cta_secondary_url` VARCHAR(1000) NULL,
    `configuration_json` JSON NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `starts_at` DATETIME(3) NULL,
    `ends_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `page_sections_page_id_status_display_order_idx`(`page_id`, `status`, `display_order`),
    INDEX `page_sections_media_id_idx`(`media_id`),
    INDEX `page_sections_background_media_id_idx`(`background_media_id`),
    UNIQUE INDEX `page_sections_page_id_section_key_key`(`page_id`, `section_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `navigation_menus` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `menu_key` VARCHAR(100) NOT NULL,
    `location` VARCHAR(50) NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `navigation_menus_menu_key_key`(`menu_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `navigation_items` (
    `id` CHAR(36) NOT NULL,
    `menu_id` CHAR(36) NOT NULL,
    `parent_item_id` CHAR(36) NULL,
    `label` VARCHAR(150) NOT NULL,
    `link_type` VARCHAR(30) NOT NULL,
    `page_id` CHAR(36) NULL,
    `custom_url` VARCHAR(1000) NULL,
    `icon_media_id` CHAR(36) NULL,
    `open_in_new_tab` BOOLEAN NOT NULL DEFAULT false,
    `css_class` VARCHAR(255) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `navigation_items_menu_id_parent_item_id_status_display_order_idx`(`menu_id`, `parent_item_id`, `status`, `display_order`),
    INDEX `navigation_items_parent_item_id_idx`(`parent_item_id`),
    INDEX `navigation_items_page_id_idx`(`page_id`),
    INDEX `navigation_items_icon_media_id_idx`(`icon_media_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_metrics` (
    `id` CHAR(36) NOT NULL,
    `metric_key` VARCHAR(100) NOT NULL,
    `label` VARCHAR(150) NOT NULL,
    `numeric_value` DECIMAL(20, 2) NULL,
    `display_value` VARCHAR(100) NOT NULL,
    `icon_media_id` CHAR(36) NULL,
    `source_reference` VARCHAR(2048) NULL,
    `verified_at` DATETIME(3) NULL,
    `is_visible` BOOLEAN NOT NULL DEFAULT true,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `platform_metrics_metric_key_key`(`metric_key`),
    INDEX `platform_metrics_icon_media_id_idx`(`icon_media_id`),
    INDEX `platform_metrics_is_visible_display_order_idx`(`is_visible`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `seo_metadata` (
    `id` CHAR(36) NOT NULL,
    `owner_type` VARCHAR(50) NOT NULL,
    `owner_id` CHAR(36) NOT NULL,
    `seo_title` VARCHAR(255) NOT NULL,
    `meta_description` VARCHAR(500) NOT NULL,
    `canonical_url` VARCHAR(2048) NULL,
    `focus_keyword` VARCHAR(255) NULL,
    `og_title` VARCHAR(255) NULL,
    `og_description` VARCHAR(500) NULL,
    `og_media_id` CHAR(36) NULL,
    `twitter_title` VARCHAR(255) NULL,
    `twitter_description` VARCHAR(500) NULL,
    `twitter_media_id` CHAR(36) NULL,
    `robots_index` BOOLEAN NOT NULL DEFAULT true,
    `robots_follow` BOOLEAN NOT NULL DEFAULT true,
    `schema_json` JSON NULL,
    `hreflang_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `seo_metadata_og_media_id_idx`(`og_media_id`),
    INDEX `seo_metadata_twitter_media_id_idx`(`twitter_media_id`),
    UNIQUE INDEX `seo_metadata_owner_type_owner_id_key`(`owner_type`, `owner_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `redirects` (
    `id` CHAR(36) NOT NULL,
    `source_path` VARCHAR(1000) NOT NULL,
    `target_path` VARCHAR(1000) NOT NULL,
    `http_status_code` INTEGER NOT NULL DEFAULT 301,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `hit_count` BIGINT NOT NULL DEFAULT 0,
    `last_hit_at` DATETIME(3) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `redirects_source_path_key`(`source_path`(750)),
    INDEX `redirects_created_by_user_id_idx`(`created_by_user_id`),
    INDEX `redirects_is_active_http_status_code_idx`(`is_active`, `http_status_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `continents` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(150) NOT NULL,
    `code` VARCHAR(20) NULL,
    `emoji` VARCHAR(20) NULL,
    `short_description` VARCHAR(1000) NULL,
    `overview` TEXT NULL,
    `icon_media_id` CHAR(36) NULL,
    `hero_media_id` CHAR(36) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_by_user_id` CHAR(36) NULL,
    `updated_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `continents_name_key`(`name`),
    UNIQUE INDEX `continents_slug_key`(`slug`),
    UNIQUE INDEX `continents_code_key`(`code`),
    INDEX `continents_icon_media_id_idx`(`icon_media_id`),
    INDEX `continents_hero_media_id_idx`(`hero_media_id`),
    INDEX `continents_created_by_user_id_idx`(`created_by_user_id`),
    INDEX `continents_updated_by_user_id_idx`(`updated_by_user_id`),
    INDEX `continents_status_display_order_idx`(`status`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `intakes` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `month_number` TINYINT NULL,
    `season_name` VARCHAR(50) NULL,
    `short_label` VARCHAR(50) NULL,
    `description` VARCHAR(500) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `intakes_name_key`(`name`),
    UNIQUE INDEX `intakes_slug_key`(`slug`),
    INDEX `intakes_status_display_order_idx`(`status`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subjects` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `short_description` VARCHAR(1000) NULL,
    `overview` LONGTEXT NULL,
    `icon_media_id` CHAR(36) NULL,
    `listing_media_id` CHAR(36) NULL,
    `hero_media_id` CHAR(36) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `updated_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `subjects_name_key`(`name`),
    UNIQUE INDEX `subjects_slug_key`(`slug`),
    INDEX `subjects_icon_media_id_idx`(`icon_media_id`),
    INDEX `subjects_listing_media_id_idx`(`listing_media_id`),
    INDEX `subjects_hero_media_id_idx`(`hero_media_id`),
    INDEX `subjects_created_by_user_id_idx`(`created_by_user_id`),
    INDEX `subjects_updated_by_user_id_idx`(`updated_by_user_id`),
    INDEX `subjects_status_is_featured_display_order_idx`(`status`, `is_featured`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_subjects` (
    `id` CHAR(36) NOT NULL,
    `subject_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `short_description` VARCHAR(1000) NULL,
    `overview` LONGTEXT NULL,
    `icon_media_id` CHAR(36) NULL,
    `listing_media_id` CHAR(36) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `updated_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `sub_subjects_slug_key`(`slug`),
    INDEX `sub_subjects_subject_id_status_display_order_idx`(`subject_id`, `status`, `display_order`),
    INDEX `sub_subjects_icon_media_id_idx`(`icon_media_id`),
    INDEX `sub_subjects_listing_media_id_idx`(`listing_media_id`),
    INDEX `sub_subjects_created_by_user_id_idx`(`created_by_user_id`),
    INDEX `sub_subjects_updated_by_user_id_idx`(`updated_by_user_id`),
    UNIQUE INDEX `sub_subjects_subject_id_name_key`(`subject_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_levels` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `education_order` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `course_levels_code_key`(`code`),
    UNIQUE INDEX `course_levels_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `study_modes` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `study_modes_code_key`(`code`),
    UNIQUE INDEX `study_modes_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `countries` (
    `id` CHAR(36) NOT NULL,
    `continent_id` CHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `short_name` VARCHAR(100) NULL,
    `page_heading` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `iso2_code` CHAR(2) NULL,
    `iso3_code` CHAR(3) NULL,
    `dial_code` VARCHAR(10) NULL,
    `capital_city` VARCHAR(150) NULL,
    `nationality_name` VARCHAR(150) NULL,
    `currency_name` VARCHAR(100) NULL,
    `currency_code` CHAR(3) NULL,
    `currency_symbol` VARCHAR(10) NULL,
    `timezone_json` JSON NULL,
    `flag_media_id` CHAR(36) NULL,
    `listing_media_id` CHAR(36) NULL,
    `hero_media_id` CHAR(36) NULL,
    `map_media_id` CHAR(36) NULL,
    `short_description` VARCHAR(1000) NOT NULL,
    `overview` LONGTEXT NULL,
    `featured_label` VARCHAR(100) NULL,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `is_popular` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `last_verified_at` DATETIME(3) NULL,
    `primary_source_url` VARCHAR(2048) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `updated_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `countries_name_key`(`name`),
    UNIQUE INDEX `countries_slug_key`(`slug`),
    UNIQUE INDEX `countries_iso2_code_key`(`iso2_code`),
    UNIQUE INDEX `countries_iso3_code_key`(`iso3_code`),
    INDEX `countries_continent_id_status_display_order_idx`(`continent_id`, `status`, `display_order`),
    INDEX `countries_status_is_featured_is_popular_idx`(`status`, `is_featured`, `is_popular`),
    INDEX `countries_flag_media_id_idx`(`flag_media_id`),
    INDEX `countries_listing_media_id_idx`(`listing_media_id`),
    INDEX `countries_hero_media_id_idx`(`hero_media_id`),
    INDEX `countries_map_media_id_idx`(`map_media_id`),
    INDEX `countries_created_by_user_id_idx`(`created_by_user_id`),
    INDEX `countries_updated_by_user_id_idx`(`updated_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `country_aliases` (
    `id` CHAR(36) NOT NULL,
    `country_id` CHAR(36) NOT NULL,
    `alias` VARCHAR(255) NOT NULL,
    `normalized_alias` VARCHAR(255) NOT NULL,
    `alias_type` VARCHAR(30) NOT NULL DEFAULT 'COMMON',
    `locale` VARCHAR(20) NOT NULL DEFAULT 'en',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `country_aliases_country_id_idx`(`country_id`),
    INDEX `country_aliases_normalized_alias_idx`(`normalized_alias`),
    UNIQUE INDEX `country_aliases_country_id_normalized_alias_key`(`country_id`, `normalized_alias`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `country_cost_profiles` (
    `id` CHAR(36) NOT NULL,
    `country_id` CHAR(36) NOT NULL,
    `currency_code` CHAR(3) NOT NULL,
    `currency_symbol` VARCHAR(10) NULL,
    `tuition_min` DECIMAL(12, 2) NULL,
    `tuition_max` DECIMAL(12, 2) NULL,
    `tuition_period` VARCHAR(30) NOT NULL DEFAULT 'PER_YEAR',
    `tuition_notes` TEXT NULL,
    `living_cost_min` DECIMAL(12, 2) NULL,
    `living_cost_max` DECIMAL(12, 2) NULL,
    `living_cost_period` VARCHAR(30) NOT NULL DEFAULT 'PER_MONTH',
    `living_cost_notes` TEXT NULL,
    `accommodation_min` DECIMAL(12, 2) NULL,
    `accommodation_max` DECIMAL(12, 2) NULL,
    `food_cost_min` DECIMAL(12, 2) NULL,
    `food_cost_max` DECIMAL(12, 2) NULL,
    `transport_cost_min` DECIMAL(12, 2) NULL,
    `transport_cost_max` DECIMAL(12, 2) NULL,
    `health_insurance_cost` DECIMAL(12, 2) NULL,
    `application_fee_min` DECIMAL(12, 2) NULL,
    `application_fee_max` DECIMAL(12, 2) NULL,
    `budget_band` VARCHAR(30) NULL,
    `applicable_year` SMALLINT NULL,
    `source_reference` VARCHAR(2048) NULL,
    `disclaimer` TEXT NULL,
    `verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `country_cost_profiles_country_id_key`(`country_id`),
    INDEX `country_cost_profiles_budget_band_applicable_year_idx`(`budget_band`, `applicable_year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `country_work_profiles` (
    `id` CHAR(36) NOT NULL,
    `country_id` CHAR(36) NOT NULL,
    `part_time_allowed` BOOLEAN NOT NULL DEFAULT false,
    `part_time_hours_per_week` DECIMAL(5, 2) NULL,
    `part_time_hours_during_breaks` DECIMAL(5, 2) NULL,
    `part_time_summary` TEXT NULL,
    `post_study_work_available` BOOLEAN NOT NULL DEFAULT false,
    `post_study_work_min_months` INTEGER NULL,
    `post_study_work_max_months` INTEGER NULL,
    `post_study_work_summary` TEXT NULL,
    `immigration_pathway_strength` VARCHAR(30) NULL,
    `immigration_pathway_summary` TEXT NULL,
    `visa_success_band` VARCHAR(30) NOT NULL DEFAULT 'NOT_PUBLISHED',
    `visa_success_percentage` DECIMAL(5, 2) NULL,
    `visa_information` LONGTEXT NULL,
    `visa_processing_time` VARCHAR(255) NULL,
    `proof_of_funds_summary` TEXT NULL,
    `source_reference` VARCHAR(2048) NULL,
    `disclaimer` TEXT NULL,
    `verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `country_work_profiles_country_id_key`(`country_id`),
    INDEX `country_work_profiles_part_time_allowed_post_study_work_avai_idx`(`part_time_allowed`, `post_study_work_available`),
    INDEX `country_work_profiles_immigration_pathway_strength_visa_succ_idx`(`immigration_pathway_strength`, `visa_success_band`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `country_language_requirements` (
    `id` CHAR(36) NOT NULL,
    `country_id` CHAR(36) NOT NULL,
    `ielts_requirement` VARCHAR(30) NOT NULL DEFAULT 'VARIES',
    `ielts_min_score` DECIMAL(3, 1) NULL,
    `ielts_notes` VARCHAR(500) NULL,
    `pte_requirement` VARCHAR(30) NOT NULL DEFAULT 'VARIES',
    `pte_min_score` DECIMAL(5, 2) NULL,
    `pte_notes` VARCHAR(500) NULL,
    `toefl_requirement` VARCHAR(30) NOT NULL DEFAULT 'VARIES',
    `toefl_min_score` DECIMAL(5, 2) NULL,
    `toefl_notes` VARCHAR(500) NULL,
    `duolingo_requirement` VARCHAR(30) NOT NULL DEFAULT 'VARIES',
    `duolingo_min_score` DECIMAL(5, 2) NULL,
    `duolingo_notes` VARCHAR(500) NULL,
    `language_waiver_available` BOOLEAN NOT NULL DEFAULT false,
    `waiver_notes` TEXT NULL,
    `general_notes` TEXT NULL,
    `source_reference` VARCHAR(2048) NULL,
    `disclaimer` TEXT NULL,
    `verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `country_language_requirements_country_id_key`(`country_id`),
    INDEX `country_language_requirements_ielts_requirement_language_wai_idx`(`ielts_requirement`, `language_waiver_available`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `country_intakes` (
    `id` CHAR(36) NOT NULL,
    `country_id` CHAR(36) NOT NULL,
    `intake_id` CHAR(36) NOT NULL,
    `is_major` BOOLEAN NOT NULL DEFAULT false,
    `availability_status` VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    `application_opening_month` TINYINT NULL,
    `application_deadline_month` TINYINT NULL,
    `application_opening_note` VARCHAR(500) NULL,
    `application_deadline_note` VARCHAR(500) NULL,
    `notes` TEXT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `country_intakes_country_id_idx`(`country_id`),
    INDEX `country_intakes_intake_id_is_major_availability_status_idx`(`intake_id`, `is_major`, `availability_status`),
    UNIQUE INDEX `country_intakes_country_id_intake_id_key`(`country_id`, `intake_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `country_statistics` (
    `id` CHAR(36) NOT NULL,
    `country_id` CHAR(36) NOT NULL,
    `universities_count` INTEGER NOT NULL DEFAULT 0,
    `public_universities_count` INTEGER NOT NULL DEFAULT 0,
    `private_universities_count` INTEGER NOT NULL DEFAULT 0,
    `courses_count` INTEGER NOT NULL DEFAULT 0,
    `ug_courses_count` INTEGER NOT NULL DEFAULT 0,
    `pg_courses_count` INTEGER NOT NULL DEFAULT 0,
    `pgdm_courses_count` INTEGER NOT NULL DEFAULT 0,
    `mba_courses_count` INTEGER NOT NULL DEFAULT 0,
    `phd_courses_count` INTEGER NOT NULL DEFAULT 0,
    `scholarships_count` INTEGER NOT NULL DEFAULT 0,
    `cities_count` INTEGER NOT NULL DEFAULT 0,
    `top_ranked_universities_count` INTEGER NOT NULL DEFAULT 0,
    `international_students_count` INTEGER NULL,
    `student_satisfaction_percentage` DECIMAL(5, 2) NULL,
    `source_mode` VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    `source_reference` VARCHAR(2048) NULL,
    `verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `country_statistics_country_id_key`(`country_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `country_content_sections` (
    `id` CHAR(36) NOT NULL,
    `country_id` CHAR(36) NOT NULL,
    `section_key` VARCHAR(100) NOT NULL,
    `section_type` VARCHAR(50) NOT NULL DEFAULT 'RICH_TEXT',
    `eyebrow` VARCHAR(255) NULL,
    `heading` VARCHAR(500) NULL,
    `subheading` TEXT NULL,
    `body_json` JSON NULL,
    `primary_media_id` CHAR(36) NULL,
    `secondary_media_id` CHAR(36) NULL,
    `cta_label` VARCHAR(100) NULL,
    `cta_url` VARCHAR(1000) NULL,
    `configuration_json` JSON NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `country_content_sections_country_id_status_display_order_idx`(`country_id`, `status`, `display_order`),
    INDEX `country_content_sections_primary_media_id_idx`(`primary_media_id`),
    INDEX `country_content_sections_secondary_media_id_idx`(`secondary_media_id`),
    UNIQUE INDEX `country_content_sections_country_id_section_key_key`(`country_id`, `section_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `country_faqs` (
    `id` CHAR(36) NOT NULL,
    `country_id` CHAR(36) NOT NULL,
    `question` VARCHAR(1000) NOT NULL,
    `answer` LONGTEXT NOT NULL,
    `category` VARCHAR(100) NULL,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_by_user_id` CHAR(36) NULL,
    `updated_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `country_faqs_country_id_status_display_order_idx`(`country_id`, `status`, `display_order`),
    INDEX `country_faqs_created_by_user_id_idx`(`created_by_user_id`),
    INDEX `country_faqs_updated_by_user_id_idx`(`updated_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `country_tags` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `tag_type` VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    `description` VARCHAR(500) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `country_tags_name_key`(`name`),
    UNIQUE INDEX `country_tags_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `country_tag_map` (
    `id` CHAR(36) NOT NULL,
    `country_id` CHAR(36) NOT NULL,
    `tag_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `country_tag_map_country_id_idx`(`country_id`),
    INDEX `country_tag_map_tag_id_country_id_idx`(`tag_id`, `country_id`),
    UNIQUE INDEX `country_tag_map_country_id_tag_id_key`(`country_id`, `tag_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `courses` (
    `id` CHAR(36) NOT NULL,
    `subject_id` CHAR(36) NOT NULL,
    `sub_subject_id` CHAR(36) NULL,
    `course_level_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `short_name` VARCHAR(150) NULL,
    `qualification_name` VARCHAR(255) NULL,
    `slug` VARCHAR(255) NOT NULL,
    `course_code` VARCHAR(100) NULL,
    `short_description` VARCHAR(1000) NULL,
    `overview` LONGTEXT NULL,
    `duration_min` DECIMAL(6, 2) NULL,
    `duration_max` DECIMAL(6, 2) NULL,
    `duration_unit` VARCHAR(30) NULL,
    `credits` DECIMAL(8, 2) NULL,
    `featured_media_id` CHAR(36) NULL,
    `career_summary` TEXT NULL,
    `average_starting_salary` DECIMAL(12, 2) NULL,
    `salary_currency_code` CHAR(3) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `popularity_score` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `updated_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `courses_slug_key`(`slug`),
    INDEX `courses_subject_id_sub_subject_id_course_level_id_status_idx`(`subject_id`, `sub_subject_id`, `course_level_id`, `status`),
    INDEX `courses_course_level_id_idx`(`course_level_id`),
    INDEX `courses_sub_subject_id_idx`(`sub_subject_id`),
    INDEX `courses_featured_media_id_idx`(`featured_media_id`),
    INDEX `courses_created_by_user_id_idx`(`created_by_user_id`),
    INDEX `courses_updated_by_user_id_idx`(`updated_by_user_id`),
    INDEX `courses_status_is_featured_popularity_score_idx`(`status`, `is_featured`, `popularity_score`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_study_modes` (
    `id` CHAR(36) NOT NULL,
    `course_id` CHAR(36) NOT NULL,
    `study_mode_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `course_study_modes_course_id_idx`(`course_id`),
    INDEX `course_study_modes_study_mode_id_idx`(`study_mode_id`),
    UNIQUE INDEX `course_study_modes_course_id_study_mode_id_key`(`course_id`, `study_mode_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `country_courses` (
    `id` CHAR(36) NOT NULL,
    `country_id` CHAR(36) NOT NULL,
    `course_id` CHAR(36) NOT NULL,
    `availability_status` VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    `indicative_tuition_min` DECIMAL(12, 2) NULL,
    `indicative_tuition_max` DECIMAL(12, 2) NULL,
    `currency_code` CHAR(3) NULL,
    `tuition_period` VARCHAR(30) NOT NULL DEFAULT 'PER_YEAR',
    `application_fee_min` DECIMAL(12, 2) NULL,
    `application_fee_max` DECIMAL(12, 2) NULL,
    `duration_min_override` DECIMAL(6, 2) NULL,
    `duration_max_override` DECIMAL(6, 2) NULL,
    `duration_unit_override` VARCHAR(30) NULL,
    `academic_min_percentage` DECIMAL(5, 2) NULL,
    `academic_min_cgpa` DECIMAL(4, 2) NULL,
    `ielts_min_score` DECIMAL(3, 1) NULL,
    `pte_min_score` DECIMAL(5, 2) NULL,
    `toefl_min_score` DECIMAL(5, 2) NULL,
    `duolingo_min_score` DECIMAL(5, 2) NULL,
    `work_experience_months` INTEGER NULL,
    `scholarship_available` BOOLEAN NOT NULL DEFAULT false,
    `admission_requirements` LONGTEXT NULL,
    `english_requirements` LONGTEXT NULL,
    `application_notes` TEXT NULL,
    `career_opportunities` TEXT NULL,
    `source_reference` VARCHAR(2048) NULL,
    `verified_at` DATETIME(3) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `country_courses_country_id_status_is_featured_idx`(`country_id`, `status`, `is_featured`),
    INDEX `country_courses_course_id_status_idx`(`course_id`, `status`),
    UNIQUE INDEX `country_courses_country_id_course_id_key`(`country_id`, `course_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `country_course_intakes` (
    `id` CHAR(36) NOT NULL,
    `country_course_id` CHAR(36) NOT NULL,
    `intake_id` CHAR(36) NOT NULL,
    `application_deadline` DATE NULL,
    `deadline_notes` VARCHAR(500) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `country_course_intakes_country_course_id_idx`(`country_course_id`),
    INDEX `country_course_intakes_intake_id_status_idx`(`intake_id`, `status`),
    UNIQUE INDEX `country_course_intakes_country_course_id_intake_id_key`(`country_course_id`, `intake_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_content_sections` (
    `id` CHAR(36) NOT NULL,
    `course_id` CHAR(36) NOT NULL,
    `section_key` VARCHAR(100) NOT NULL,
    `heading` VARCHAR(500) NULL,
    `subheading` TEXT NULL,
    `body_json` JSON NULL,
    `media_id` CHAR(36) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `course_content_sections_course_id_status_display_order_idx`(`course_id`, `status`, `display_order`),
    INDEX `course_content_sections_media_id_idx`(`media_id`),
    UNIQUE INDEX `course_content_sections_course_id_section_key_key`(`course_id`, `section_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_faqs` (
    `id` CHAR(36) NOT NULL,
    `course_id` CHAR(36) NOT NULL,
    `question` VARCHAR(1000) NOT NULL,
    `answer` LONGTEXT NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `course_faqs_course_id_status_display_order_idx`(`course_id`, `status`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `related_courses` (
    `id` CHAR(36) NOT NULL,
    `course_id` CHAR(36) NOT NULL,
    `related_course_id` CHAR(36) NOT NULL,
    `relationship_type` VARCHAR(30) NOT NULL DEFAULT 'RELATED',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `related_courses_course_id_idx`(`course_id`),
    INDEX `related_courses_related_course_id_idx`(`related_course_id`),
    UNIQUE INDEX `related_courses_course_id_related_course_id_relationship_typ_key`(`course_id`, `related_course_id`, `relationship_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consultant_landing_cards` (
    `id` CHAR(36) NOT NULL,
    `country_id` CHAR(36) NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `short_description` VARCHAR(1000) NOT NULL,
    `overview` LONGTEXT NULL,
    `icon_media_id` CHAR(36) NULL,
    `featured_media_id` CHAR(36) NULL,
    `is_free_consultation` BOOLEAN NOT NULL DEFAULT true,
    `cta_label` VARCHAR(100) NOT NULL DEFAULT 'View consultants',
    `cta_url` VARCHAR(1000) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `consultant_landing_cards_slug_key`(`slug`),
    INDEX `consultant_landing_cards_country_id_status_display_order_idx`(`country_id`, `status`, `display_order`),
    INDEX `consultant_landing_cards_icon_media_id_idx`(`icon_media_id`),
    INDEX `consultant_landing_cards_featured_media_id_idx`(`featured_media_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leads` (
    `id` CHAR(36) NOT NULL,
    `lead_number` VARCHAR(50) NOT NULL,
    `form_type` VARCHAR(50) NOT NULL,
    `source_type` VARCHAR(50) NULL,
    `source_entity_id` CHAR(36) NULL,
    `source_page_url` VARCHAR(2048) NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NULL,
    `email` VARCHAR(255) NULL,
    `phone_country_code` VARCHAR(10) NULL,
    `phone_number` VARCHAR(30) NOT NULL,
    `current_city` VARCHAR(150) NULL,
    `current_state` VARCHAR(150) NULL,
    `current_country` VARCHAR(150) NULL,
    `preferred_country_id` CHAR(36) NULL,
    `preferred_course_id` CHAR(36) NULL,
    `preferred_subject_id` CHAR(36) NULL,
    `preferred_course_level_id` CHAR(36) NULL,
    `preferred_intake_id` CHAR(36) NULL,
    `budget_min` DECIMAL(12, 2) NULL,
    `budget_max` DECIMAL(12, 2) NULL,
    `budget_currency_code` CHAR(3) NULL,
    `english_test_type` VARCHAR(30) NULL,
    `english_test_score` DECIMAL(6, 2) NULL,
    `highest_qualification` VARCHAR(255) NULL,
    `message` TEXT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'NEW',
    `priority` VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    `assigned_to_user_id` CHAR(36) NULL,
    `next_follow_up_at` DATETIME(3) NULL,
    `marketing_consent` BOOLEAN NOT NULL DEFAULT false,
    `privacy_consent` BOOLEAN NOT NULL DEFAULT false,
    `utm_source` VARCHAR(255) NULL,
    `utm_medium` VARCHAR(255) NULL,
    `utm_campaign` VARCHAR(255) NULL,
    `utm_term` VARCHAR(255) NULL,
    `utm_content` VARCHAR(255) NULL,
    `referrer_url` VARCHAR(2048) NULL,
    `landing_page_url` VARCHAR(2048) NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(1000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `leads_lead_number_key`(`lead_number`),
    INDEX `leads_status_created_at_idx`(`status`, `created_at`),
    INDEX `leads_phone_number_idx`(`phone_number`),
    INDEX `leads_email_idx`(`email`),
    INDEX `leads_assigned_to_user_id_status_idx`(`assigned_to_user_id`, `status`),
    INDEX `leads_preferred_country_id_preferred_course_id_idx`(`preferred_country_id`, `preferred_course_id`),
    INDEX `leads_preferred_subject_id_idx`(`preferred_subject_id`),
    INDEX `leads_preferred_course_level_id_idx`(`preferred_course_level_id`),
    INDEX `leads_preferred_intake_id_idx`(`preferred_intake_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `counselling_bookings` (
    `id` CHAR(36) NOT NULL,
    `lead_id` CHAR(36) NOT NULL,
    `booking_date` DATE NOT NULL,
    `slot_start_at` DATETIME(3) NOT NULL,
    `slot_end_at` DATETIME(3) NULL,
    `timezone` VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    `booking_mode` VARCHAR(30) NOT NULL DEFAULT 'PHONE',
    `booking_status` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    `assigned_to_user_id` CHAR(36) NULL,
    `meeting_url` VARCHAR(2048) NULL,
    `meeting_provider` VARCHAR(50) NULL,
    `meeting_id` VARCHAR(255) NULL,
    `customer_notes` TEXT NULL,
    `internal_notes` TEXT NULL,
    `confirmed_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancellation_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `counselling_bookings_lead_id_idx`(`lead_id`),
    INDEX `counselling_bookings_booking_date_booking_status_idx`(`booking_date`, `booking_status`),
    INDEX `counselling_bookings_assigned_to_user_id_slot_start_at_idx`(`assigned_to_user_id`, `slot_start_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_notes` (
    `id` CHAR(36) NOT NULL,
    `lead_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `note_type` VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
    `note` LONGTEXT NOT NULL,
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `lead_notes_lead_id_is_pinned_created_at_idx`(`lead_id`, `is_pinned`, `created_at`),
    INDEX `lead_notes_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_status_history` (
    `id` CHAR(36) NOT NULL,
    `lead_id` CHAR(36) NOT NULL,
    `old_status` VARCHAR(30) NULL,
    `new_status` VARCHAR(30) NOT NULL,
    `changed_by_user_id` CHAR(36) NULL,
    `reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_status_history_lead_id_created_at_idx`(`lead_id`, `created_at`),
    INDEX `lead_status_history_changed_by_user_id_idx`(`changed_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_templates` (
    `id` CHAR(36) NOT NULL,
    `template_key` VARCHAR(150) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `subject_template` VARCHAR(500) NOT NULL,
    `body_html` LONGTEXT NOT NULL,
    `body_text` LONGTEXT NULL,
    `variables_json` JSON NULL,
    `sender_name` VARCHAR(255) NULL,
    `reply_to_email` VARCHAR(255) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_by_user_id` CHAR(36) NULL,
    `updated_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `email_templates_template_key_key`(`template_key`),
    INDEX `email_templates_created_by_user_id_idx`(`created_by_user_id`),
    INDEX `email_templates_updated_by_user_id_idx`(`updated_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_logs` (
    `id` CHAR(36) NOT NULL,
    `template_id` CHAR(36) NULL,
    `related_entity_type` VARCHAR(50) NULL,
    `related_entity_id` CHAR(36) NULL,
    `recipient_email` VARCHAR(255) NOT NULL,
    `recipient_name` VARCHAR(255) NULL,
    `subject` VARCHAR(500) NOT NULL,
    `provider` VARCHAR(50) NULL,
    `provider_message_id` VARCHAR(255) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
    `error_message` TEXT NULL,
    `queued_at` DATETIME(3) NULL,
    `sent_at` DATETIME(3) NULL,
    `delivered_at` DATETIME(3) NULL,
    `failed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_logs_template_id_idx`(`template_id`),
    INDEX `email_logs_status_created_at_idx`(`status`, `created_at`),
    INDEX `email_logs_related_entity_type_related_entity_id_idx`(`related_entity_type`, `related_entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `search_logs` (
    `id` CHAR(36) NOT NULL,
    `search_type` VARCHAR(30) NOT NULL,
    `query_text` VARCHAR(500) NULL,
    `normalized_query` VARCHAR(500) NULL,
    `filters_json` JSON NULL,
    `sorting` VARCHAR(100) NULL,
    `result_count` INTEGER NOT NULL DEFAULT 0,
    `selected_entity_type` VARCHAR(50) NULL,
    `selected_entity_id` CHAR(36) NULL,
    `session_id` VARCHAR(255) NULL,
    `ip_hash` VARCHAR(255) NULL,
    `user_agent` VARCHAR(1000) NULL,
    `source_page_url` VARCHAR(2048) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `search_logs_search_type_created_at_idx`(`search_type`, `created_at`),
    INDEX `search_logs_normalized_query_idx`(`normalized_query`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_avatar_media_id_fkey` FOREIGN KEY (`avatar_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_assigned_by_user_id_fkey` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_replaced_by_token_id_fkey` FOREIGN KEY (`replaced_by_token_id`) REFERENCES `refresh_tokens`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `login_attempts` ADD CONSTRAINT `login_attempts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media_assets` ADD CONSTRAINT `media_assets_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_settings` ADD CONSTRAINT `site_settings_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pages` ADD CONSTRAINT `pages_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pages` ADD CONSTRAINT `pages_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `page_sections` ADD CONSTRAINT `page_sections_page_id_fkey` FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `page_sections` ADD CONSTRAINT `page_sections_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `page_sections` ADD CONSTRAINT `page_sections_background_media_id_fkey` FOREIGN KEY (`background_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `navigation_items` ADD CONSTRAINT `navigation_items_menu_id_fkey` FOREIGN KEY (`menu_id`) REFERENCES `navigation_menus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `navigation_items` ADD CONSTRAINT `navigation_items_parent_item_id_fkey` FOREIGN KEY (`parent_item_id`) REFERENCES `navigation_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `navigation_items` ADD CONSTRAINT `navigation_items_page_id_fkey` FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `navigation_items` ADD CONSTRAINT `navigation_items_icon_media_id_fkey` FOREIGN KEY (`icon_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_metrics` ADD CONSTRAINT `platform_metrics_icon_media_id_fkey` FOREIGN KEY (`icon_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `seo_metadata` ADD CONSTRAINT `seo_metadata_og_media_id_fkey` FOREIGN KEY (`og_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `seo_metadata` ADD CONSTRAINT `seo_metadata_twitter_media_id_fkey` FOREIGN KEY (`twitter_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redirects` ADD CONSTRAINT `redirects_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `continents` ADD CONSTRAINT `continents_icon_media_id_fkey` FOREIGN KEY (`icon_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `continents` ADD CONSTRAINT `continents_hero_media_id_fkey` FOREIGN KEY (`hero_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `continents` ADD CONSTRAINT `continents_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `continents` ADD CONSTRAINT `continents_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_icon_media_id_fkey` FOREIGN KEY (`icon_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_listing_media_id_fkey` FOREIGN KEY (`listing_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_hero_media_id_fkey` FOREIGN KEY (`hero_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_subjects` ADD CONSTRAINT `sub_subjects_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_subjects` ADD CONSTRAINT `sub_subjects_icon_media_id_fkey` FOREIGN KEY (`icon_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_subjects` ADD CONSTRAINT `sub_subjects_listing_media_id_fkey` FOREIGN KEY (`listing_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_subjects` ADD CONSTRAINT `sub_subjects_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_subjects` ADD CONSTRAINT `sub_subjects_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `countries` ADD CONSTRAINT `countries_continent_id_fkey` FOREIGN KEY (`continent_id`) REFERENCES `continents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `countries` ADD CONSTRAINT `countries_flag_media_id_fkey` FOREIGN KEY (`flag_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `countries` ADD CONSTRAINT `countries_listing_media_id_fkey` FOREIGN KEY (`listing_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `countries` ADD CONSTRAINT `countries_hero_media_id_fkey` FOREIGN KEY (`hero_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `countries` ADD CONSTRAINT `countries_map_media_id_fkey` FOREIGN KEY (`map_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `countries` ADD CONSTRAINT `countries_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `countries` ADD CONSTRAINT `countries_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_aliases` ADD CONSTRAINT `country_aliases_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_cost_profiles` ADD CONSTRAINT `country_cost_profiles_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_work_profiles` ADD CONSTRAINT `country_work_profiles_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_language_requirements` ADD CONSTRAINT `country_language_requirements_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_intakes` ADD CONSTRAINT `country_intakes_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_intakes` ADD CONSTRAINT `country_intakes_intake_id_fkey` FOREIGN KEY (`intake_id`) REFERENCES `intakes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_statistics` ADD CONSTRAINT `country_statistics_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_content_sections` ADD CONSTRAINT `country_content_sections_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_content_sections` ADD CONSTRAINT `country_content_sections_primary_media_id_fkey` FOREIGN KEY (`primary_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_content_sections` ADD CONSTRAINT `country_content_sections_secondary_media_id_fkey` FOREIGN KEY (`secondary_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_faqs` ADD CONSTRAINT `country_faqs_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_faqs` ADD CONSTRAINT `country_faqs_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_faqs` ADD CONSTRAINT `country_faqs_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_tag_map` ADD CONSTRAINT `country_tag_map_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_tag_map` ADD CONSTRAINT `country_tag_map_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `country_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `courses` ADD CONSTRAINT `courses_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `courses` ADD CONSTRAINT `courses_sub_subject_id_fkey` FOREIGN KEY (`sub_subject_id`) REFERENCES `sub_subjects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `courses` ADD CONSTRAINT `courses_course_level_id_fkey` FOREIGN KEY (`course_level_id`) REFERENCES `course_levels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `courses` ADD CONSTRAINT `courses_featured_media_id_fkey` FOREIGN KEY (`featured_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `courses` ADD CONSTRAINT `courses_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `courses` ADD CONSTRAINT `courses_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_study_modes` ADD CONSTRAINT `course_study_modes_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_study_modes` ADD CONSTRAINT `course_study_modes_study_mode_id_fkey` FOREIGN KEY (`study_mode_id`) REFERENCES `study_modes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_courses` ADD CONSTRAINT `country_courses_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_courses` ADD CONSTRAINT `country_courses_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_course_intakes` ADD CONSTRAINT `country_course_intakes_country_course_id_fkey` FOREIGN KEY (`country_course_id`) REFERENCES `country_courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `country_course_intakes` ADD CONSTRAINT `country_course_intakes_intake_id_fkey` FOREIGN KEY (`intake_id`) REFERENCES `intakes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_content_sections` ADD CONSTRAINT `course_content_sections_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_content_sections` ADD CONSTRAINT `course_content_sections_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_faqs` ADD CONSTRAINT `course_faqs_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `related_courses` ADD CONSTRAINT `related_courses_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `related_courses` ADD CONSTRAINT `related_courses_related_course_id_fkey` FOREIGN KEY (`related_course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultant_landing_cards` ADD CONSTRAINT `consultant_landing_cards_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultant_landing_cards` ADD CONSTRAINT `consultant_landing_cards_icon_media_id_fkey` FOREIGN KEY (`icon_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultant_landing_cards` ADD CONSTRAINT `consultant_landing_cards_featured_media_id_fkey` FOREIGN KEY (`featured_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_preferred_country_id_fkey` FOREIGN KEY (`preferred_country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_preferred_course_id_fkey` FOREIGN KEY (`preferred_course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_preferred_subject_id_fkey` FOREIGN KEY (`preferred_subject_id`) REFERENCES `subjects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_preferred_course_level_id_fkey` FOREIGN KEY (`preferred_course_level_id`) REFERENCES `course_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_preferred_intake_id_fkey` FOREIGN KEY (`preferred_intake_id`) REFERENCES `intakes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_assigned_to_user_id_fkey` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `counselling_bookings` ADD CONSTRAINT `counselling_bookings_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `counselling_bookings` ADD CONSTRAINT `counselling_bookings_assigned_to_user_id_fkey` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_notes` ADD CONSTRAINT `lead_notes_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_notes` ADD CONSTRAINT `lead_notes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_status_history` ADD CONSTRAINT `lead_status_history_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_status_history` ADD CONSTRAINT `lead_status_history_changed_by_user_id_fkey` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_templates` ADD CONSTRAINT `email_templates_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_templates` ADD CONSTRAINT `email_templates_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_logs` ADD CONSTRAINT `email_logs_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `email_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Custom reviewed MySQL full-text indexes from the Phase 1 schema blueprint.
ALTER TABLE `countries` ADD FULLTEXT INDEX `countries_name_page_heading_short_description_fulltext` (`name`, `page_heading`, `short_description`);
ALTER TABLE `courses` ADD FULLTEXT INDEX `courses_name_short_description_overview_fulltext` (`name`, `short_description`, `overview`);
