-- AlterTable
ALTER TABLE `pages` ADD COLUMN `template_id` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `page_templates` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `template_key` VARCHAR(100) NOT NULL,
    `description` VARCHAR(1000) NULL,
    `page_family` VARCHAR(60) NOT NULL,
    `default_sections_json` JSON NOT NULL,
    `layout_config_json` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` CHAR(36) NULL,
    `updated_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `page_templates_template_key_key`(`template_key`),
    INDEX `page_templates_page_family_is_active_idx`(`page_family`, `is_active`),
    INDEX `page_templates_created_by_user_id_idx`(`created_by_user_id`),
    INDEX `page_templates_updated_by_user_id_idx`(`updated_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `pages_template_id_idx` ON `pages`(`template_id`);

-- AddForeignKey
ALTER TABLE `pages` ADD CONSTRAINT `pages_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `page_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `page_templates` ADD CONSTRAINT `page_templates_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `page_templates` ADD CONSTRAINT `page_templates_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
