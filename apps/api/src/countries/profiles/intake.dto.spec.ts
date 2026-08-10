import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateIntakeDto } from './profile.dto';

describe('CreateIntakeDto', () => {
  it.each([0, 13])('rejects invalid month %i', async (month) => {
    const dto = plainToInstance(CreateIntakeDto, {
      name: 'September intake',
      startMonth: month,
      endMonth: 9,
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'startMonth')).toBe(true);
  });

  it('allows a range that crosses the year boundary', async () => {
    const dto = plainToInstance(CreateIntakeDto, {
      name: 'Winter intake',
      startMonth: 11,
      endMonth: 2,
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});
