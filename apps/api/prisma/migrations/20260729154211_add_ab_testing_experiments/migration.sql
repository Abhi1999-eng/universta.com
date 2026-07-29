-- CreateTable
CREATE TABLE `experiments` (
    `id` CHAR(36) NOT NULL,
    `key` VARCHAR(150) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` VARCHAR(1000) NULL,
    `section_id` CHAR(36) NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `starts_at` DATETIME(3) NULL,
    `ends_at` DATETIME(3) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `experiments_key_key`(`key`),
    INDEX `experiments_section_id_status_idx`(`section_id`, `status`),
    INDEX `experiments_created_by_user_id_idx`(`created_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experiment_variants` (
    `id` CHAR(36) NOT NULL,
    `experiment_id` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `is_control` BOOLEAN NOT NULL DEFAULT false,
    `traffic_weight` INTEGER NOT NULL DEFAULT 0,
    `eyebrow` VARCHAR(255) NULL,
    `heading` VARCHAR(500) NULL,
    `subheading` TEXT NULL,
    `cta_primary_label` VARCHAR(100) NULL,
    `cta_primary_url` VARCHAR(1000) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `experiment_variants_experiment_id_key_key`(`experiment_id`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experiment_exposures` (
    `id` CHAR(36) NOT NULL,
    `experiment_id` CHAR(36) NOT NULL,
    `variant_id` CHAR(36) NOT NULL,
    `anonymous_id` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `experiment_exposures_experiment_id_variant_id_idx`(`experiment_id`, `variant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experiment_conversions` (
    `id` CHAR(36) NOT NULL,
    `experiment_id` CHAR(36) NOT NULL,
    `variant_id` CHAR(36) NOT NULL,
    `anonymous_id` VARCHAR(100) NOT NULL,
    `kind` VARCHAR(50) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `experiment_conversions_experiment_id_variant_id_kind_idx`(`experiment_id`, `variant_id`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `experiments` ADD CONSTRAINT `experiments_section_id_fkey` FOREIGN KEY (`section_id`) REFERENCES `page_sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experiments` ADD CONSTRAINT `experiments_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experiment_variants` ADD CONSTRAINT `experiment_variants_experiment_id_fkey` FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experiment_exposures` ADD CONSTRAINT `experiment_exposures_experiment_id_fkey` FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experiment_exposures` ADD CONSTRAINT `experiment_exposures_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `experiment_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experiment_conversions` ADD CONSTRAINT `experiment_conversions_experiment_id_fkey` FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experiment_conversions` ADD CONSTRAINT `experiment_conversions_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `experiment_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
