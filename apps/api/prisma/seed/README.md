# Subjects and specializations

`subjects-taxonomy.sql` loads the taxonomy the client works from: 30 subjects,
927 specializations, and a link from every country to all of them. That last
part is the agreed starting point — narrowing it down per destination is what
the country editor is for.

It ships with the release, so on the server it sits at
`/opt/universta/current/apps/api/prisma/seed/subjects-taxonomy.sql`.

## Running it

Only after the migration that scopes a specialization slug to its subject and
creates `country_sub_subjects`. Before that, `country_sub_subjects` does not
exist and the 179 specialization names that appear under more than one subject
collide with each other.

The file opens a transaction and ends with a count of what it wrote. Read those
counts, then `COMMIT;` yourself — it deliberately does not commit for you.

Applying it twice is safe: subjects and specializations upsert on their unique
keys, and the country links are `INSERT IGNORE`.

## Regenerating it

```
node apps/api/prisma/seed/build-taxonomy.mjs <path-to-Subjects.xlsx> apps/api/prisma/seed/subjects-taxonomy.sql
```

The workbook's `Sheet2` is the source: column A names a subject on the first row
of its group, column B lists its specializations. Nine rows repeat a name inside
its own subject and are dropped; the rest of the file is other views of the same
data.
