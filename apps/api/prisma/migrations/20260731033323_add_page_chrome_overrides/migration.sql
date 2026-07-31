-- AlterTable
ALTER TABLE `page_templates` ADD COLUMN `chrome_config_json` JSON NULL;

-- AlterTable
ALTER TABLE `pages` ADD COLUMN `chrome_config_json` JSON NULL;
