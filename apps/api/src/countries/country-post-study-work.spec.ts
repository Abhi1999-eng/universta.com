import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateCountryDto } from './dto/country.dto';

/**
 * The maximum post-study work permit is optional and clearable. Omitting it
 * leaves the stored figure alone; null clears it. The shared number transform
 * turned null into 0, and the editor sent nothing for an emptied box, so a
 * figure once saved could never be removed from the guide.
 */
const parse = (value: Record<string, unknown>) =>
  plainToInstance(UpdateCountryDto, { name: 'Germany', ...value });

describe('post-study work permit months', () => {
  it('keeps null, so the figure can be cleared', async () => {
    const dto = parse({ postStudyWorkPermitMonths: null });
    expect(dto.postStudyWorkPermitMonths).toBeNull();
    expect(await validate(dto)).toEqual([]);
  });

  it('leaves an omitted figure alone', () => {
    expect(parse({}).postStudyWorkPermitMonths).toBeUndefined();
  });

  it('reads a number sent as text', async () => {
    const dto = parse({ postStudyWorkPermitMonths: '18' });
    expect(dto.postStudyWorkPermitMonths).toBe(18);
    expect(await validate(dto)).toEqual([]);
  });

  it('still refuses a figure out of range', async () => {
    const issues = await validate(parse({ postStudyWorkPermitMonths: 500 }));
    expect(issues.map((issue) => issue.property)).toContain(
      'postStudyWorkPermitMonths',
    );
  });
});
