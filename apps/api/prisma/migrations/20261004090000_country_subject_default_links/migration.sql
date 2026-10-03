-- Every destination lists every subject until an editor narrows it.
--
-- The application now writes these links when a country or a subject is
-- created, which does nothing for the ones that already existed: on the
-- catalogue as it stands that is two hundred and five destinations and
-- thirty subjects with almost no link between them, so the country editor
-- opens every one of them on an empty subject list.
--
-- A migration rather than a script, because it has to run exactly once per
-- database. Run on every deploy it would put back whatever an editor had
-- unticked since the last one; the migrations table is what remembers that
-- it has already happened.
--
-- EDITORIAL, which is the value the country editor can remove. The taxonomy
-- sweep that follows every deploy marks a row DERIVED where a published
-- course stands behind it.
--
-- INSERT IGNORE against the unique (country_id, subject_id): a pair that is
-- already linked keeps the row it has, including its source.
--
-- Archived records are included. A link to one is invisible -- every reader
-- filters the record's own status -- and it is what lets a restored country
-- come back with its subjects.
INSERT IGNORE INTO `country_subjects`
  (`id`, `country_id`, `subject_id`, `display_order`, `source`, `created_at`)
SELECT UUID(), c.`id`, s.`id`, 0, 'EDITORIAL', NOW(3)
FROM `countries` c
CROSS JOIN `subjects` s;
