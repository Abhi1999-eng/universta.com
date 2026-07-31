-- AlterTable
ALTER TABLE `refresh_tokens` ADD COLUMN `grace_use_count` INTEGER NOT NULL DEFAULT 0;
