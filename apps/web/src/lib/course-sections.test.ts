import { describe, expect, it } from 'vitest';
import {
  courseSections,
  sectionItems,
  sectionParagraphs,
  sectionSteps,
  type CourseSection,
} from './course-sections';

const section = (over: Partial<CourseSection>): CourseSection => ({
  id: 's',
  sectionKey: 'curriculum',
  sectionType: 'RICH_TEXT',
  heading: null,
  subheading: null,
  bodyJson: null,
  media: null,
  displayOrder: 0,
  ...over,
});

describe('reading a course section', () => {
  it('reads a checklist’s items and drops blank lines', () => {
    expect(
      sectionItems(section({ bodyJson: { items: ['Transcripts', '  ', 3, 'Passport '] } })),
    ).toEqual(['Transcripts', 'Passport']);
  });

  it('orders steps by the number an editor gave them', () => {
    expect(
      sectionSteps(
        section({
          bodyJson: {
            steps: [
              { order: 3, text: 'Enrol' },
              { order: 1, text: 'Choose a lab' },
              { order: 2, text: '' },
              { order: 2, text: 'Sit the exam' },
            ],
          },
        }),
      ),
    ).toEqual(['Choose a lab', 'Sit the exam', 'Enrol']);
  });

  it('falls back from steps to items and from items to steps', () => {
    expect(sectionSteps(section({ bodyJson: { items: ['One', 'Two'] } }))).toEqual(['One', 'Two']);
    expect(sectionItems(section({ bodyJson: { steps: [{ order: 1, text: 'One' }] } }))).toEqual([
      'One',
    ]);
  });

  it('reads paragraphs and nothing from a body of another shape', () => {
    expect(sectionParagraphs(section({ bodyJson: { paragraphs: ['<p>A</p>'] } }))).toEqual([
      '<p>A</p>',
    ]);
    expect(sectionParagraphs(section({ bodyJson: { paragraphs: 'A' } }))).toEqual([]);
    expect(sectionItems(null)).toEqual([]);
  });
});

describe('the sections a guide draws', () => {
  it('finds each by the admin’s key', () => {
    const found = courseSections([
      section({ sectionKey: 'skills', bodyJson: { items: ['A'] } }),
      section({ sectionKey: 'admission-requirements', bodyJson: { paragraphs: ['B'] } }),
      section({ sectionKey: 'documents', bodyJson: { items: ['C'] } }),
      section({ sectionKey: 'career-outcomes', bodyJson: { items: ['D'] } }),
      section({ sectionKey: 'application-process', bodyJson: { steps: [{ order: 1, text: 'E' }] } }),
      section({ sectionKey: 'source-trust', bodyJson: { paragraphs: ['F'] } }),
      section({ sectionKey: 'counselling-cta', heading: 'Talk to us' }),
    ]);
    expect(found.skills?.sectionKey).toBe('skills');
    expect(found.admission?.sectionKey).toBe('admission-requirements');
    expect(found.documents?.sectionKey).toBe('documents');
    expect(found.careers?.sectionKey).toBe('career-outcomes');
    expect(found.application?.sectionKey).toBe('application-process');
    expect(found.sources?.sectionKey).toBe('source-trust');
    expect(found.counselling?.heading).toBe('Talk to us');
  });

  it('still reads the keys the guide used to look for', () => {
    const found = courseSections([
      section({ sectionKey: 'eligibility', bodyJson: { paragraphs: ['A'] } }),
      section({ sectionKey: 'apply', bodyJson: { paragraphs: ['B'] } }),
    ]);
    expect(found.admission?.sectionKey).toBe('eligibility');
    expect(found.application?.sectionKey).toBe('apply');
  });

  it('passes over a section with a heading and nothing under it', () => {
    expect(courseSections([section({ sectionKey: 'skills', heading: 'Skills' })]).skills).toBeNull();
  });
});
