-- A testimonial can speak for a destination rather than for one university.
-- Nullable, so every existing row keeps meaning exactly what it meant: a
-- testimonial attached to a university or an offering leaves this null.
ALTER TABLE `testimonials` ADD COLUMN `country_id` CHAR(36) NULL;

-- CreateIndex
CREATE INDEX `testimonials_country_id_status_display_order_idx` ON `testimonials`(`country_id`, `status`, `display_order`);

-- AddForeignKey
ALTER TABLE `testimonials` ADD CONSTRAINT `testimonials_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
