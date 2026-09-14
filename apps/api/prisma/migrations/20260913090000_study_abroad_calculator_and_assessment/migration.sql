-- Study Abroad: two additive columns, both nullable.
--
-- 1. countries.calculator_config
--
-- The approved design's budget calculator is driven by factor groups -- city
-- band, housing, programme type, lifestyle -- where each option carries either
-- a multiplier on living costs or a tuition band. Nothing in the catalogue
-- models that. The Cost Profile stays canonical for the base living figures the
-- calculator starts from; this column only holds the factors that vary them, so
-- a country with no configuration simply has no calculator rather than a wrong
-- one.
--
-- JSON rather than four new tables because the shape is a small, whole
-- document that is always read and written together, is validated at the API
-- boundary before it is stored, and has no query or join requirement of its
-- own. A normalised schema here would be four tables and three joins to
-- reassemble a value that is never queried across countries.
--
-- 2. leads.assessment_json
--
-- The assessment collects ten answers. Six of them already have canonical
-- columns on this table and continue to be written there -- preferred country,
-- study level, subject, intake, budget and English status -- so every existing
-- Admin filter and report keeps working unchanged. The remaining four
-- (academic score band, work experience, application intent, and the computed
-- intent band) have nowhere to live, and one nullable document beats four
-- columns that only one form ever populates.
--
-- Both columns are NULL for every existing row and no existing value is read,
-- rewritten or retyped. Rolling back is a DROP COLUMN on each.

ALTER TABLE `countries`
  ADD COLUMN `calculator_config` JSON NULL AFTER `intake_months`;

ALTER TABLE `leads`
  ADD COLUMN `assessment_json` JSON NULL AFTER `message`;

-- The assessment writes leads with form_type 'ASSESSMENT'. Admin lists and
-- filters leads by that column, and it is already indexed as part of the
-- existing lead listing index, so no new index is required here.
