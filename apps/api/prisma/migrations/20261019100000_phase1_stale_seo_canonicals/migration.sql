-- The admin's shared record editor used to open on the resolved SEO -- the
-- record's own address among it -- and saving the form stored that address
-- as a hand-written canonical. After a slug change the page kept pointing
-- search engines at its old, dead address while the sitemap listed the new
-- one. The editor no longer does this; this clears what it left behind.
--
-- A stored canonical is cleared only when it names the record's own public
-- address, or an old address that now redirects there. Either way the page
-- builds the same address itself, so nothing an editor chose is lost.
-- Data only, and safe to run again: a second run finds nothing to clear.

UPDATE `seo_metadata` AS m
JOIN `success_stories` AS r ON r.`id` = m.`owner_id`
SET m.`canonical_url` = NULL
WHERE m.`owner_type` = 'success-stories'
  AND m.`canonical_url` IS NOT NULL
  AND (
    m.`canonical_url` = CONCAT('/success-stories/', r.`slug`)
    OR EXISTS (
      SELECT 1 FROM `redirects` AS d
      WHERE d.`source_path` = m.`canonical_url`
        AND d.`target_path` = CONCAT('/success-stories/', r.`slug`)
    )
  );

UPDATE `seo_metadata` AS m
JOIN `events` AS r ON r.`id` = m.`owner_id`
SET m.`canonical_url` = NULL
WHERE m.`owner_type` = 'events'
  AND m.`canonical_url` IS NOT NULL
  AND (
    m.`canonical_url` = CONCAT('/events/', r.`slug`)
    OR EXISTS (
      SELECT 1 FROM `redirects` AS d
      WHERE d.`source_path` = m.`canonical_url`
        AND d.`target_path` = CONCAT('/events/', r.`slug`)
    )
  );

UPDATE `seo_metadata` AS m
JOIN `jobs` AS r ON r.`id` = m.`owner_id`
SET m.`canonical_url` = NULL
WHERE m.`owner_type` = 'jobs'
  AND m.`canonical_url` IS NOT NULL
  AND (
    m.`canonical_url` = CONCAT('/careers/', r.`slug`)
    OR EXISTS (
      SELECT 1 FROM `redirects` AS d
      WHERE d.`source_path` = m.`canonical_url`
        AND d.`target_path` = CONCAT('/careers/', r.`slug`)
    )
  );

UPDATE `seo_metadata` AS m
JOIN `consultants` AS r ON r.`id` = m.`owner_id`
SET m.`canonical_url` = NULL
WHERE m.`owner_type` = 'consultants'
  AND m.`canonical_url` IS NOT NULL
  AND (
    m.`canonical_url` = CONCAT('/study-abroad-consultants/', r.`slug`)
    OR EXISTS (
      SELECT 1 FROM `redirects` AS d
      WHERE d.`source_path` = m.`canonical_url`
        AND d.`target_path` = CONCAT('/study-abroad-consultants/', r.`slug`)
    )
  );
