CREATE TABLE `lead_consultant_assignments` (
  `lead_id` CHAR(36) NOT NULL,
  `consultant_id` CHAR(36) NOT NULL,
  `assigned_by_user_id` CHAR(36) NULL,
  `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`lead_id`),
  INDEX `lead_consultant_assignments_consultant_id_idx` (`consultant_id`),
  INDEX `lead_consultant_assignments_assigned_by_user_id_idx` (`assigned_by_user_id`),
  CONSTRAINT `lead_consultant_assignments_lead_id_fkey`
    FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `lead_consultant_assignments_consultant_id_fkey`
    FOREIGN KEY (`consultant_id`) REFERENCES `consultants` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `lead_consultant_assignments_assigned_by_user_id_fkey`
    FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
