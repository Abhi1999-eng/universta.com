# Subject level discovery and UK layout acceptance

10 October 2026. Screenshots show the local web app with read-only public production catalogue data: 13 UK universities and 73 published programmes. These changes require the owner’s merge approval before deployment.

## Delivered behavior

- `/subjects/{subject}/levels/{level}` and `/subjects/{subject}/{specialization}/levels/{level}` keep the field and level fixed while searching, filtering, switching views, clearing filters and paging. Canonical levels are `foundation`, `pathway`, `bachelors`, `masters`, `mba`, `phd`; UG/PG code aliases redirect. Existing subject and specialization pages link all six levels, including empty ones.
- Published university programmes and generic course guides have distinct counts and views. Empty known levels remain scoped; invalid paths return 404. Scoped suggestions use scoped catalogue reads. Filtered variants are not indexed.
- Homepage suggestions extend beyond the hero boundary and fit the available viewport. Mouse/touch scrolling and arrow-key selection can reach the final result without clipping; Escape and the plain search form remain available.
- Country university cards omit repeated flags. Global directory cards retain them. Cards in a desktop row share section positions; mobile cards remain compact.
- Country hero uses one main “Study in…” heading above its flag accent. The original colour proportions fill the complete strip, including the right edge.
- Guide Clear all uses native navigation to avoid the installed Next version repeating a cached URL fragment.

## Verification

- Web unit suite: 121 files, 1,374 tests passed. The final search-empty copy follow-up also passed the 15-test ProgrammeResults suite.
- Changed TypeScript/TSX files: ESLint passed. `npm run verify` passed (existing lint warnings only). Final web production build passed with webpack because local dependency symlinks are outside Turbopack’s project root.
- Manual built-in browser checks: homepage dropdown at 1280/390; last suggestion, wheel scrolling and Escape; subject Bachelor’s → guides → UK filter → Clear all; specialization Master’s → empty MBA; mobile filter drawer open/close; 13 global university flags retained; UK first-row stats/description/subject/action positions equal; strip right edge filled at 1280/390.
- Seven browser regressions added for CI: level links, aliases, invalid paths, scoped filter clearing and desktop/mobile suggestion clipping/scrolling.

## Screenshots

| View | Desktop | Mobile |
| --- | --- | --- |
| Homepage search | [Before](home-search-before-1280.jpg), [After](home-search-after-1280.jpg) | [After](home-search-after-390.jpg) |
| Specialization and level | [Master’s](specialization-masters-1280.jpg) | [Master’s](specialization-masters-390.jpg) |
| UK university cards | [After](uk-cards-after-1280.jpg) | [After](uk-cards-after-390.jpg) |
| UK hero and flag strip | [After](uk-hero-after-1280.jpg) | [After](uk-hero-after-390.jpg) |
