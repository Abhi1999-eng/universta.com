-- A destination's study paths, typed in the country form.
--
-- The guide printed the same four levels on every country page from a list in
-- the web app: Bachelor's, Master's, MBA and PhD, each with a duration and an
-- entry requirement. A country nobody had filled in showed them, and no editor
-- could change them. They move here so that the page shows what the form
-- holds and nothing when it holds nothing.
--
-- Nullable, with no backfill: every existing country starts with none, and its
-- study-path section stands down until somebody fills it in.
ALTER TABLE `countries`
  ADD COLUMN `study_paths` JSON NULL;
