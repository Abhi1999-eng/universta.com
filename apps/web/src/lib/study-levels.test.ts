import { describe, expect, it } from 'vitest';
import type { Course, CourseLevelGroup } from '@/lib/catalog';
import {
  hasLevelPage,
  LEVELS_ALWAYS_SHOWN,
  levelPages,
  levelsOnBar,
  specializationLevelPages,
  specializationOfferedLevels,
  subjectLevelPages,
  subjectOfferedLevels,
} from '@/lib/course-levels';
import { namesInProse, studyLevelPanels, studyLevelsLead } from '@/lib/study-levels';

const UG = { id: 'ug', code: 'UG', name: "Bachelor's", educationOrder: 3 };
const PG = { id: 'pg', code: 'PG', name: "Master's", educationOrder: 4 };
const MBA = { id: 'mba', code: 'MBA', name: 'MBA', educationOrder: 5 };
const PHD = { id: 'phd', code: 'PHD', name: 'PhD', educationOrder: 6 };
const FOUNDATION = { id: 'f', code: 'FOUNDATION', name: 'Foundation Program', educationOrder: 1 };
const PATHWAY = { id: 'p', code: 'PATHWAY', name: 'Pathway Program', educationOrder: 2 };
const DIPLOMA = { id: 'd', code: 'DIPLOMA', name: 'Diploma', educationOrder: 2.5 };
const CATALOGUE = [PHD, UG, FOUNDATION, MBA, PATHWAY, PG, DIPLOMA];

const course = (id: string, branch: string | null) =>
  ({ id, name: id, slug: id, subSubject: branch ? { id: branch, name: branch, slug: branch } : null }) as unknown as Course;
const group = (level: typeof UG, count: number, courses: Course[]): CourseLevelGroup => ({
  level: { ...level, educationOrder: level.educationOrder },
  count,
  courses,
});

describe('the levels a subject is offered at', () => {
  it('is what was ticked on the subject together with its specializations’ levels', () => {
    expect(
      subjectOfferedLevels({ offeredLevels: [UG, PHD], subSubjects: [{ levels: [MBA] }] }).map((l) => l.code),
    ).toEqual(['UG', 'PHD', 'MBA']);
  });

  it('never loses a specialization’s level to a narrower tick on the subject', () => {
    /* Ticked for Master's alone, with a Data Science branch at Bachelor's
       and Master's and an AI branch at Master's and PhD. */
    expect(
      subjectOfferedLevels({
        offeredLevels: [PG],
        subSubjects: [{ levels: [UG, PG] }, { levels: [PG, PHD] }],
      }).map((l) => l.code),
    ).toEqual(['PG', 'UG', 'PHD']);
  });

  it('adds a level the subject offers beyond its specializations', () => {
    expect(
      subjectOfferedLevels({
        offeredLevels: [FOUNDATION, UG],
        subSubjects: [{ levels: [UG, PG] }],
      }).map((l) => l.code),
    ).toEqual(['FOUNDATION', 'UG', 'PG']);
  });

  it('is its specializations’ levels, each once, when nothing is ticked on it', () => {
    expect(
      subjectOfferedLevels({ offeredLevels: [], subSubjects: [{ levels: [PG, PHD] }, { levels: [PHD, UG] }] }).map(
        (l) => l.code,
      ),
    ).toEqual(['PG', 'PHD', 'UG']);
  });

  it('is empty when neither says, so the page shows the six named levels', () => {
    expect(subjectOfferedLevels({ subSubjects: [{ levels: [] }] })).toEqual([]);
  });

  it('adds the levels its own published courses are at', () => {
    expect(
      subjectOfferedLevels({
        offeredLevels: [],
        subSubjects: [],
        courseCountsByLevel: [{ level: DIPLOMA, count: 2 }],
      }).map((l) => l.code),
    ).toEqual(['DIPLOMA']);
    expect(
      subjectOfferedLevels({
        offeredLevels: [PG],
        subSubjects: [{ levels: [PHD] }],
        courseCountsByLevel: [{ level: UG, count: 3 }, { level: PG, count: 1 }],
      }).map((l) => l.code),
    ).toEqual(['PG', 'PHD', 'UG']);
  });

  it('ignores a level counted at nought: a count row alone claims nothing', () => {
    expect(
      subjectOfferedLevels({ offeredLevels: [], courseCountsByLevel: [{ level: MBA, count: 0 }] }),
    ).toEqual([]);
  });
});

describe('the levels a specialization is offered at', () => {
  it('is its own ticks together with the levels of its courses, each once', () => {
    expect(
      specializationOfferedLevels({ offeredLevels: [PG], levels: [PG, PHD] }),
    ).toEqual([PG, PHD]);
    expect(
      specializationOfferedLevels({ offeredLevels: [PG, MBA], levels: [UG] }).map((l) => l.code),
    ).toEqual(['PG', 'MBA', 'UG']);
  });

  it('unticked, is the levels its courses are at, as its card says', () => {
    expect(specializationOfferedLevels({ offeredLevels: [], levels: [PHD] })).toEqual([
      PHD,
    ]);
  });

  it('with neither, is nothing -- it does not borrow its subject’s ticks', () => {
    /* The subject's ticks are what it offers beyond its branches, a
       Foundation year say; a branch with no levels of its own must not
       claim them. Its pages show the six named levels, unclaimed. */
    expect(specializationOfferedLevels({ offeredLevels: [], levels: [] })).toEqual([]);
    expect(specializationOfferedLevels({})).toEqual([]);
  });
});

describe('a field’s level pages', () => {
  it('are the levels it is offered at, claimed', () => {
    const pages = levelPages([PG, UG, { code: null }]);
    expect(pages.claimed).toBe(true);
    expect([...pages.codes]).toEqual(['PG', 'UG']);
  });

  it('are the six named levels, unclaimed, when it is offered at none', () => {
    for (const offered of [[], null, undefined]) {
      const pages = levelPages(offered);
      expect(pages.claimed).toBe(false);
      expect([...pages.codes]).toEqual([...LEVELS_ALWAYS_SHOWN]);
    }
  });

  it('answers for a level whatever its case, and never for none', () => {
    const pages = levelPages([PG]);
    expect(hasLevelPage(pages, 'PG')).toBe(true);
    expect(hasLevelPage(pages, 'pg')).toBe(true);
    expect(hasLevelPage(pages, 'UG')).toBe(false);
    expect(hasLevelPage(pages, null)).toBe(false);
    expect(hasLevelPage(pages, undefined)).toBe(false);
    expect(hasLevelPage(levelPages([]), 'DIPLOMA')).toBe(false);
    expect(hasLevelPage(levelPages([]), 'FOUNDATION')).toBe(true);
  });

  it('follow the offered rules for a subject and a specialization', () => {
    const subject = subjectLevelPages({
      offeredLevels: [FOUNDATION],
      subSubjects: [{ levels: [PG] }],
      courseCountsByLevel: [{ level: DIPLOMA, count: 1 }],
    });
    expect([...subject.codes]).toEqual(['FOUNDATION', 'PG', 'DIPLOMA']);
    /* A specialization answers for its own levels, never its subject's. */
    const specialization = specializationLevelPages({ offeredLevels: [PG], levels: [PHD] });
    expect([...specialization.codes]).toEqual(['PG', 'PHD']);
    expect(hasLevelPage(specialization, 'FOUNDATION')).toBe(false);
  });

  /* A level switched off in Admin, Course levels, leaves the catalogue's
     list, but the courses filed at it still count towards a field's
     levels. A field offered there alone claimed a level with no page, and
     every level it might have shown was a 404. */
  it('count only the catalogue’s levels, and with none of those left are the six, unclaimed', () => {
    const active = [FOUNDATION, PATHWAY, UG, PG, MBA, PHD];
    const mixed = levelPages([DIPLOMA, PG], active);
    expect(mixed.claimed).toBe(true);
    expect([...mixed.codes]).toEqual(['PG']);
    const subject = subjectLevelPages(
      { offeredLevels: [], subSubjects: [], courseCountsByLevel: [{ level: DIPLOMA, count: 4 }] },
      active,
    );
    expect(subject.claimed).toBe(false);
    expect([...subject.codes]).toEqual([...LEVELS_ALWAYS_SHOWN]);
    expect(levelsOnBar(active, subject).map((level) => level.code)).toEqual([
      'FOUNDATION',
      'PATHWAY',
      'UG',
      'PG',
      'MBA',
      'PHD',
    ]);
    expect(specializationLevelPages({ levels: [DIPLOMA] }, active).claimed).toBe(false);
    /* Without the catalogue's list, nothing is taken away. */
    expect(levelPages([DIPLOMA], null).claimed).toBe(true);
    expect(levelPages([DIPLOMA], []).claimed).toBe(true);
  });
});

describe('a level bar', () => {
  it('offers exactly the levels the field has pages for, in climbing order', () => {
    expect(levelsOnBar(CATALOGUE, levelPages([PHD, UG, MBA])).map((l) => l.code)).toEqual(['UG', 'MBA', 'PHD']);
  });

  it('offers the six named levels when nothing is offered', () => {
    expect(levelsOnBar(CATALOGUE, levelPages([])).map((l) => l.code)).toEqual([
      'FOUNDATION',
      'PATHWAY',
      'UG',
      'PG',
      'MBA',
      'PHD',
    ]);
  });

  it('never offers a catalogue level the field has no page for', () => {
    expect(levelsOnBar(CATALOGUE, levelPages([PG])).map((l) => l.code)).toEqual(['PG']);
    expect(levelsOnBar(CATALOGUE, levelPages([])).map((l) => l.code)).not.toContain('DIPLOMA');
  });
});

describe('a destination’s study-level panels', () => {
  const branches = [
    { id: 'ai', name: 'Artificial Intelligence', slug: 'ai', levels: [PG, PHD] },
    { id: 'ds', name: 'Data Science', slug: 'ds', levels: [UG] },
    { id: 'web', name: 'Web', slug: 'web', levels: [] },
  ];

  it('names the specializations offered at a level and those with a course filed under it here', () => {
    const [pg] = studyLevelPanels([group(PG, 2, [course('a', 'web'), course('b', 'web')])], branches);
    expect(pg.specializations).toEqual([
      { id: 'web', name: 'Web', slug: 'web', here: 2 },
      { id: 'ai', name: 'Artificial Intelligence', slug: 'ai', here: 0 },
    ]);
  });

  it('does not count a level holding more courses than the page read', () => {
    const [pg] = studyLevelPanels([group(PG, 40, [course('a', 'ai')])], branches);
    expect(pg.specializations.map((entry) => entry.here)).toEqual([null]);
  });

  it('names no specializations on a specialization’s own page', () => {
    expect(studyLevelPanels([group(UG, 0, [])])[0].specializations).toEqual([]);
  });
});

describe('the study levels lead', () => {
  const branches = [{ id: 'ai', name: 'AI', slug: 'ai', levels: [PG] }];

  it('names the levels, how to pick one and, once, the ones with nothing here', () => {
    const panels = studyLevelPanels(
      [group(UG, 0, []), group(PG, 1, [course('a', null)]), group(PHD, 1, [course('b', null)])],
      branches,
    );
    expect(studyLevelsLead({ field: 'Computer Science', where: 'Japan', panels, offered: true })).toBe(
      "Computer Science is offered at Bachelor's, Master's and PhD. Pick a level to see its specializations and the courses listed in Japan. Bachelor's has no course listed in Japan yet.",
    );
  });

  it('names the levels with courses instead, when they are the fewer', () => {
    const panels = studyLevelPanels([group(UG, 0, []), group(PG, 1, [course('a', null)]), group(PHD, 0, [])], branches);
    expect(studyLevelsLead({ field: 'Computer Science', where: 'Japan', panels, offered: true })).toMatch(
      / Only Master's has courses listed in Japan so far\.$/,
    );
  });

  it('leaves the all-empty case to the notice above it, and offers only what a level holds', () => {
    const bare = studyLevelPanels([group(UG, 0, []), group(PG, 0, [])]);
    expect(studyLevelsLead({ field: 'AI', where: 'Japan', panels: bare, offered: true })).toBe("AI is offered at Bachelor's and Master's.");
    const branched = studyLevelPanels([group(UG, 0, []), group(PG, 0, [])], [
      { id: 'ds', name: 'Data Science', slug: 'ds', levels: [UG] },
    ]);
    expect(studyLevelsLead({ field: 'CS', where: 'Japan', panels: branched, offered: true })).toBe(
      "CS is offered at Bachelor's and Master's. Pick a level to see the specializations taught at it.",
    );
  });

  it('on a specialization’s page, offers the courses alone', () => {
    const panels = studyLevelPanels([group(PG, 1, [course('a', null)]), group(PHD, 1, [course('b', null)])]);
    expect(studyLevelsLead({ field: 'AI', where: 'Japan', panels, offered: true })).toBe(
      "AI is offered at Master's and PhD. Pick a level to see the courses listed in Japan.",
    );
  });

  it('never claims the six levels a page shows when nothing says what it is offered at', () => {
    const six = studyLevelPanels([group(FOUNDATION, 0, []), group(UG, 0, []), group(PG, 1, [course('a', null)])]);
    const lead = studyLevelsLead({ field: 'History', where: 'Japan', panels: six, offered: false });
    expect(lead).not.toContain('offered at');
    expect(lead).toBe("Pick a level to see the courses listed in Japan. Only Master's has courses listed in Japan so far.");
    const empty = studyLevelPanels([group(FOUNDATION, 0, []), group(UG, 0, [])]);
    expect(studyLevelsLead({ field: 'History', where: 'Japan', panels: empty, offered: false })).toBe(
      'Courses are filed under these study levels as they are listed in Japan.',
    );
  });

  it('joins names as a sentence does', () => {
    expect(namesInProse([])).toBe('');
    expect(namesInProse(['PhD'])).toBe('PhD');
    expect(namesInProse(['MBA', 'PhD'])).toBe('MBA and PhD');
  });
});
