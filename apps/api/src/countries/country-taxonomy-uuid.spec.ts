import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateCountryDto } from './dto/country.dto';
import { StudyModeReplacementDto } from '../courses/dto/course.dto';

/**
 * Most of this catalogue's ids were minted by MySQL's own `UUID()` in the
 * taxonomy seed, which issues version 1; the rest by Prisma's
 * `@default(uuid())`, which issues version 4. The country DTO required
 * version 4, so the Admin could not hand back the ids the database had given
 * it -- and once a new country started with the whole catalogue selected,
 * every create was refused with "each value in subjectIds must be a UUID",
 * about ids the server itself had made.
 */

// From the production taxonomy seed: `045cc244-baad-11f1-...` is a v1 id.
const V1 = '045cc244-baad-11f1-b903-02b479165b33';
const V4 = '8b4a5f26-d6db-4515-b0e3-c0ff9c0c8c4e';

function errorsFor(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateCountryDto, {
    name: 'Testland',
    ...payload,
  });
  return validateSync(dto, { whitelist: true }).flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );
}

describe('country taxonomy ids', () => {
  it('accepts the version 1 ids the seed created', () => {
    expect(errorsFor({ subjectIds: [V1], subSubjectIds: [V1] })).toEqual([]);
  });

  it('still accepts the version 4 ids Prisma creates', () => {
    expect(errorsFor({ subjectIds: [V4], subSubjectIds: [V4] })).toEqual([]);
  });

  it('accepts a catalogue that mixes both, as the real one does', () => {
    expect(errorsFor({ subjectIds: [V1, V4] })).toEqual([]);
  });

  it('still rejects something that is not a uuid at all', () => {
    const errors = errorsFor({ subjectIds: ['not-an-id'] });
    expect(errors.join(' ')).toMatch(/must be a UUID/i);
  });

  it('applies to tags and the popular lists as well', () => {
    expect(
      errorsFor({
        tagIds: [V1],
        popularUniversityIds: [V1],
        popularCourseIds: [V1],
      }),
    ).toEqual([]);
  });

  it('applies to a course’s study modes too', () => {
    const dto = plainToInstance(StudyModeReplacementDto, {
      studyModeIds: [V1],
    });
    expect(validateSync(dto)).toEqual([]);
  });
});
