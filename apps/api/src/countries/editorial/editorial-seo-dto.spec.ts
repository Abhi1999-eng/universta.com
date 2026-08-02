import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SeoMetadataDto } from './editorial.dto';

/** ISS-027. SeoEditor.tsx starts every optional field from '' and never
 * changes it to undefined when left untouched, so a save that never touches
 * canonicalUrl still submits it as ''. `@IsOptional()` only skips validation
 * for `undefined`, not '', so `@IsUrl()` rejected every save of a Country's
 * SEO metadata that didn't also set a canonical URL -- which, in practice,
 * was every one of them (canonicalUrl is opt-in, not required). */
describe('SeoMetadataDto — canonicalUrl left blank', () => {
  const base = {
    seoTitle: 'Study in Canada',
    metaDescription: 'Everything you need to know.',
  };

  it('passes validation when canonicalUrl is an empty string', async () => {
    const dto = plainToInstance(SeoMetadataDto, { ...base, canonicalUrl: '' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('still rejects a canonicalUrl that is present but not a real URL', async () => {
    const dto = plainToInstance(SeoMetadataDto, {
      ...base,
      canonicalUrl: 'not a url',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'canonicalUrl')).toBe(
      true,
    );
  });

  it('still accepts a valid canonicalUrl', async () => {
    const dto = plainToInstance(SeoMetadataDto, {
      ...base,
      canonicalUrl: 'https://universta.com/study-in-canada',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects when canonicalUrl is omitted entirely (same as blank)', async () => {
    const dto = plainToInstance(SeoMetadataDto, { ...base });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
