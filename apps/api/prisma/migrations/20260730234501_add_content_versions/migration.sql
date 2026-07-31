-- CreateTable
CREATE TABLE `content_versions` (
    `id` CHAR(36) NOT NULL,
    `resource_type` VARCHAR(40) NOT NULL,
    `resource_id` VARCHAR(150) NOT NULL,
    `version_number` INTEGER NOT NULL,
    `snapshot_json` JSON NOT NULL,
    `change_summary` VARCHAR(500) NOT NULL,
    `source_action` VARCHAR(60) NOT NULL,
    `restored_from_version` INTEGER NULL,
    `created_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `content_versions_resource_type_resource_id_created_at_idx`(`resource_type`, `resource_id`, `created_at`),
    INDEX `content_versions_created_by_user_id_idx`(`created_by_user_id`),
    UNIQUE INDEX `content_versions_resource_type_resource_id_version_number_key`(`resource_type`, `resource_id`, `version_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `content_versions` ADD CONSTRAINT `content_versions_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
