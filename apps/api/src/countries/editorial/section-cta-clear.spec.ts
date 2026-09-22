import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ContentSectionDto } from './editorial.dto';

/**
 * A section's call to action is cleared by sending an empty link. Omitting
 * the key leaves it as it was, and the link's pattern refused "", so once a
 * section had a call to action it could never be removed.
 */
const issues = async (ctaUrl: string) =>
  (
    await validate(
      plainToInstance(ContentSectionDto, {
        sectionType: 'RICH_TEXT',
        heading: 'Why',
        ctaUrl,
      }),
    )
  ).map((issue) => issue.property);

describe('section call-to-action link', () => {
  it('accepts an empty link, which clears it', async () => {
    expect(await issues('')).not.toContain('ctaUrl');
  });

  it('still refuses a link that is not a path, an anchor or https', async () => {
    expect(await issues('javascript:alert(1)')).toContain('ctaUrl');
  });

  it('accepts a site path', async () => {
    expect(await issues('/counselling')).not.toContain('ctaUrl');
  });
});
