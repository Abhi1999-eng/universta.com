import { describe, expect, it } from 'vitest';
import { profileFor } from './study-abroad-assessment';

/**
 * The result screen is the student's own answers read back to them, so it has
 * to say what they picked in the words they picked it, and nothing they did not.
 */
describe('profileFor', () => {
  const guides = [
    { slug: 'canada', name: 'Canada' },
    { slug: 'germany', name: 'Germany' },
  ];

  it('lists each answer by the label the student chose, in question order', () => {
    expect(
      profileFor({ level: 'masters', field: 'computer-science', intent: 'ready' }, guides),
    ).toEqual([
      { id: 'field', question: 'What do you want to study', answer: 'Computer Science & IT' },
      { id: 'level', question: 'Which level are you applying for', answer: "Master's" },
      { id: 'intent', question: 'Where are you in the process', answer: 'Ready to apply' },
    ]);
  });

  it('names the destination from the guides rather than printing its slug', () => {
    expect(profileFor({ destination: 'germany' }, guides)).toEqual([
      { id: 'destination', question: 'Which destination are you leaning towards', answer: 'Germany' },
    ]);
  });

  /* A skipped question is simply not in the profile, rather than a row that
     says nothing. */
  it('leaves out what was skipped', () => {
    expect(profileFor({}, guides)).toEqual([]);
  });

  it('falls back to the stored value when the label cannot be found', () => {
    expect(profileFor({ destination: 'atlantis' }, guides)[0].answer).toBe('atlantis');
  });
});
