-- CreateTable
CREATE TABLE `university_claim_requests` (
    `id` CHAR(36) NOT NULL,
    `university_id` CHAR(36) NOT NULL,
    `claim_number` VARCHAR(50) NOT NULL,
    `claimant_name` VARCHAR(255) NOT NULL,
    `work_email` VARCHAR(255) NOT NULL,
    `job_title` VARCHAR(255) NULL,
    `organization` VARCHAR(255) NULL,
    `phone_number` VARCHAR(50) NULL,
    `official_website` VARCHAR(2048) NULL,
    `message` TEXT NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
    `reviewed_by_user_id` CHAR(36) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `university_claim_requests_claim_number_key`(`claim_number`),
    INDEX `university_claim_requests_university_id_status_idx`(`university_id`, `status`),
    INDEX `university_claim_requests_work_email_status_idx`(`work_email`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `university_claim_notes` (
    `id` CHAR(36) NOT NULL,
    `claim_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `note` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `university_claim_notes_claim_id_created_at_idx`(`claim_id`, `created_at`),
    INDEX `university_claim_notes_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `university_claim_status_history` (
    `id` CHAR(36) NOT NULL,
    `claim_id` CHAR(36) NOT NULL,
    `old_status` VARCHAR(30) NULL,
    `new_status` VARCHAR(30) NOT NULL,
    `changed_by_user_id` CHAR(36) NULL,
    `reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `university_claim_status_history_claim_id_created_at_idx`(`claim_id`, `created_at`),
    INDEX `university_claim_status_history_changed_by_user_id_idx`(`changed_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `university_claim_requests` ADD CONSTRAINT `university_claim_requests_university_id_fkey` FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `university_claim_requests` ADD CONSTRAINT `university_claim_requests_reviewed_by_user_id_fkey` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `university_claim_notes` ADD CONSTRAINT `university_claim_notes_claim_id_fkey` FOREIGN KEY (`claim_id`) REFERENCES `university_claim_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `university_claim_notes` ADD CONSTRAINT `university_claim_notes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `university_claim_status_history` ADD CONSTRAINT `university_claim_status_history_claim_id_fkey` FOREIGN KEY (`claim_id`) REFERENCES `university_claim_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `university_claim_status_history` ADD CONSTRAINT `university_claim_status_history_changed_by_user_id_fkey` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
