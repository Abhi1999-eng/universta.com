-- Phase 2 student portal records. This migration is intentionally additive:
-- existing catalogue, counselling lead, and Admin-managed records are untouched.

ALTER TABLE `student_profiles` ADD COLUMN `referral_code` VARCHAR(40) NULL;
CREATE UNIQUE INDEX `student_profiles_referral_code_key` ON `student_profiles`(`referral_code`);

CREATE TABLE `student_saved_universities` (
  `student_profile_id` CHAR(36) NOT NULL,
  `university_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `student_saved_universities_university_id_idx`(`university_id`),
  PRIMARY KEY (`student_profile_id`, `university_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_saved_offerings` (
  `student_profile_id` CHAR(36) NOT NULL,
  `offering_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `student_saved_offerings_offering_id_idx`(`offering_id`),
  PRIMARY KEY (`student_profile_id`, `offering_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_saved_scholarships` (
  `student_profile_id` CHAR(36) NOT NULL,
  `scholarship_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `student_saved_scholarships_scholarship_id_idx`(`scholarship_id`),
  PRIMARY KEY (`student_profile_id`, `scholarship_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_applications` (
  `id` CHAR(36) NOT NULL,
  `student_profile_id` CHAR(36) NOT NULL,
  `university_id` CHAR(36) NOT NULL,
  `offering_id` CHAR(36) NULL,
  `target_intake_id` CHAR(36) NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'APPLICATION_STARTED',
  `university_name_snapshot` VARCHAR(255) NOT NULL,
  `offering_name_snapshot` VARCHAR(255) NULL,
  `submitted_at` DATETIME(3) NULL,
  `decision_at` DATETIME(3) NULL,
  `offer_media_id` CHAR(36) NULL,
  `offer_decision` VARCHAR(20) NULL,
  `offer_decision_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `student_applications_student_profile_id_status_updated_at_idx`(`student_profile_id`, `status`, `updated_at`),
  INDEX `student_applications_university_id_idx`(`university_id`),
  INDEX `student_applications_offering_id_idx`(`offering_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_application_timeline` (
  `id` CHAR(36) NOT NULL,
  `application_id` CHAR(36) NOT NULL,
  `status` VARCHAR(40) NOT NULL,
  `message` VARCHAR(1000) NULL,
  `actor_type` VARCHAR(20) NOT NULL,
  `changed_by_user_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `student_application_timeline_application_id_created_at_idx`(`application_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_application_documents` (
  `application_id` CHAR(36) NOT NULL,
  `student_document_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `student_application_documents_student_document_id_idx`(`student_document_id`),
  PRIMARY KEY (`application_id`, `student_document_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_scholarship_applications` (
  `id` CHAR(36) NOT NULL,
  `student_profile_id` CHAR(36) NOT NULL,
  `scholarship_id` CHAR(36) NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'STARTED',
  `scholarship_title_snapshot` VARCHAR(255) NOT NULL,
  `submitted_at` DATETIME(3) NULL,
  `decision_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `student_scholarship_applications_student_profile_id_status_u_idx`(`student_profile_id`, `status`, `updated_at`),
  UNIQUE INDEX `student_scholarship_applications_student_profile_id_scholars_key`(`student_profile_id`, `scholarship_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_scholarship_timeline` (
  `id` CHAR(36) NOT NULL,
  `scholarship_application_id` CHAR(36) NOT NULL,
  `status` VARCHAR(30) NOT NULL,
  `message` VARCHAR(1000) NULL,
  `actor_type` VARCHAR(20) NOT NULL,
  `changed_by_user_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `student_scholarship_timeline_scholarship_application_id_crea_idx`(`scholarship_application_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_scholarship_documents` (
  `scholarship_application_id` CHAR(36) NOT NULL,
  `student_document_id` CHAR(36) NOT NULL,
  INDEX `student_scholarship_documents_student_document_id_idx`(`student_document_id`),
  PRIMARY KEY (`scholarship_application_id`, `student_document_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_consultant_assignments` (
  `id` CHAR(36) NOT NULL,
  `student_profile_id` CHAR(36) NOT NULL,
  `consultant_id` CHAR(36) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ended_at` DATETIME(3) NULL,
  INDEX `student_consultant_assignments_student_profile_id_status_idx`(`student_profile_id`, `status`),
  INDEX `student_consultant_assignments_consultant_id_status_idx`(`consultant_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_conversations` (
  `id` CHAR(36) NOT NULL,
  `student_profile_id` CHAR(36) NOT NULL,
  `consultant_assignment_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `student_conversations_student_profile_id_updated_at_idx`(`student_profile_id`, `updated_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_messages` (
  `id` CHAR(36) NOT NULL,
  `conversation_id` CHAR(36) NOT NULL,
  `sender_type` VARCHAR(20) NOT NULL,
  `student_sender_id` CHAR(36) NULL,
  `internal_sender_id` CHAR(36) NULL,
  `body` TEXT NOT NULL,
  `read_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `student_messages_conversation_id_created_at_idx`(`conversation_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_notifications` (
  `id` CHAR(36) NOT NULL,
  `student_profile_id` CHAR(36) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `body` VARCHAR(1000) NULL,
  `href` VARCHAR(2048) NULL,
  `read_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `student_notifications_student_profile_id_read_at_created_at_idx`(`student_profile_id`, `read_at`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_support_tickets` (
  `id` CHAR(36) NOT NULL,
  `student_profile_id` CHAR(36) NOT NULL,
  `category` VARCHAR(30) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  `last_changed_by_user_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `student_support_tickets_student_profile_id_status_updated_at_idx`(`student_profile_id`, `status`, `updated_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_support_messages` (
  `id` CHAR(36) NOT NULL,
  `ticket_id` CHAR(36) NOT NULL,
  `sender_type` VARCHAR(20) NOT NULL,
  `sender_user_id` CHAR(36) NULL,
  `body` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `student_support_messages_ticket_id_created_at_idx`(`ticket_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_referrals` (
  `id` CHAR(36) NOT NULL,
  `referrer_profile_id` CHAR(36) NOT NULL,
  `referred_profile_id` CHAR(36) NOT NULL,
  `referral_code` VARCHAR(40) NOT NULL,
  `stage` VARCHAR(40) NOT NULL DEFAULT 'REFERRED',
  `reward_status` VARCHAR(30) NOT NULL DEFAULT 'NOT_ELIGIBLE',
  `reward_amount` DECIMAL(12,2) NULL,
  `reward_currency` CHAR(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `student_referrals_referred_profile_id_key`(`referred_profile_id`),
  INDEX `student_referrals_referrer_profile_id_stage_idx`(`referrer_profile_id`, `stage`),
  UNIQUE INDEX `student_referrals_referrer_profile_id_referred_profile_id_key`(`referrer_profile_id`, `referred_profile_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `student_saved_universities` ADD CONSTRAINT `student_saved_universities_student_profile_id_fkey` FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_saved_universities` ADD CONSTRAINT `student_saved_universities_university_id_fkey` FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_saved_offerings` ADD CONSTRAINT `student_saved_offerings_student_profile_id_fkey` FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_saved_offerings` ADD CONSTRAINT `student_saved_offerings_offering_id_fkey` FOREIGN KEY (`offering_id`) REFERENCES `university_course_offerings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_saved_scholarships` ADD CONSTRAINT `student_saved_scholarships_student_profile_id_fkey` FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_saved_scholarships` ADD CONSTRAINT `student_saved_scholarships_scholarship_id_fkey` FOREIGN KEY (`scholarship_id`) REFERENCES `scholarships`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_applications` ADD CONSTRAINT `student_applications_student_profile_id_fkey` FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_applications` ADD CONSTRAINT `student_applications_university_id_fkey` FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `student_applications` ADD CONSTRAINT `student_applications_offering_id_fkey` FOREIGN KEY (`offering_id`) REFERENCES `university_course_offerings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `student_applications` ADD CONSTRAINT `student_applications_target_intake_id_fkey` FOREIGN KEY (`target_intake_id`) REFERENCES `intakes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `student_applications` ADD CONSTRAINT `student_applications_offer_media_id_fkey` FOREIGN KEY (`offer_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `student_application_timeline` ADD CONSTRAINT `student_application_timeline_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `student_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_application_timeline` ADD CONSTRAINT `student_application_timeline_changed_by_user_id_fkey` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `student_application_documents` ADD CONSTRAINT `student_application_documents_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `student_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_application_documents` ADD CONSTRAINT `student_application_documents_student_document_id_fkey` FOREIGN KEY (`student_document_id`) REFERENCES `student_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_scholarship_applications` ADD CONSTRAINT `student_scholarship_applications_student_profile_id_fkey` FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_scholarship_applications` ADD CONSTRAINT `student_scholarship_applications_scholarship_id_fkey` FOREIGN KEY (`scholarship_id`) REFERENCES `scholarships`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `student_scholarship_timeline` ADD CONSTRAINT `student_scholarship_timeline_application_id_fkey` FOREIGN KEY (`scholarship_application_id`) REFERENCES `student_scholarship_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_scholarship_timeline` ADD CONSTRAINT `student_scholarship_timeline_changed_by_user_id_fkey` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `student_scholarship_documents` ADD CONSTRAINT `student_scholarship_documents_application_id_fkey` FOREIGN KEY (`scholarship_application_id`) REFERENCES `student_scholarship_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_scholarship_documents` ADD CONSTRAINT `student_scholarship_documents_student_document_id_fkey` FOREIGN KEY (`student_document_id`) REFERENCES `student_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_consultant_assignments` ADD CONSTRAINT `student_consultant_assignments_student_profile_id_fkey` FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_consultant_assignments` ADD CONSTRAINT `student_consultant_assignments_consultant_id_fkey` FOREIGN KEY (`consultant_id`) REFERENCES `consultants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `student_conversations` ADD CONSTRAINT `student_conversations_student_profile_id_fkey` FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_conversations` ADD CONSTRAINT `student_conversations_consultant_assignment_id_fkey` FOREIGN KEY (`consultant_assignment_id`) REFERENCES `student_consultant_assignments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `student_messages` ADD CONSTRAINT `student_messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `student_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_messages` ADD CONSTRAINT `student_messages_student_sender_id_fkey` FOREIGN KEY (`student_sender_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `student_messages` ADD CONSTRAINT `student_messages_internal_sender_id_fkey` FOREIGN KEY (`internal_sender_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `student_notifications` ADD CONSTRAINT `student_notifications_student_profile_id_fkey` FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_support_tickets` ADD CONSTRAINT `student_support_tickets_student_profile_id_fkey` FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_support_tickets` ADD CONSTRAINT `student_support_tickets_last_changed_by_user_id_fkey` FOREIGN KEY (`last_changed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `student_support_messages` ADD CONSTRAINT `student_support_messages_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `student_support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_support_messages` ADD CONSTRAINT `student_support_messages_sender_user_id_fkey` FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `student_referrals` ADD CONSTRAINT `student_referrals_referrer_profile_id_fkey` FOREIGN KEY (`referrer_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_referrals` ADD CONSTRAINT `student_referrals_referred_profile_id_fkey` FOREIGN KEY (`referred_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
