-- The catalogue seed stored every FAQ it created with display_order -1: it
-- looked each FAQ up by identity in a list it had just built again, which
-- never matches. The API refuses a negative order, so editing any seeded FAQ
-- in the country editor failed the whole save.
--
-- Renumber the FAQs of every country that has one below zero, from 0, in the
-- order they are shown today (display_order, then id), so nothing moves on
-- the page and every row can be saved again. Countries whose FAQs are all
-- ordered already are not touched.
UPDATE `country_faqs` AS f
JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (PARTITION BY `country_id` ORDER BY `display_order`, `id`) - 1 AS `position`
  FROM `country_faqs`
  WHERE `country_id` IN (
    SELECT `country_id` FROM (
      SELECT DISTINCT `country_id` FROM `country_faqs` WHERE `display_order` < 0
    ) AS `affected`
  )
) AS ranked ON ranked.`id` = f.`id`
SET f.`display_order` = ranked.`position`;
