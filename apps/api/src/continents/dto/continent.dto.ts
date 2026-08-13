import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CONTINENT_STATUSES,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  slugify,
} from '../../catalog/catalog.constants';

function trimValue({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/* The Admin form already normalizes as you type, but a slug can also arrive
 * from an API client or a pasted value with capitals or spaces. Normalizing
 * here rather than rejecting means both sides agree on what "North America"
 * becomes; `@Matches` below still guards anything slugify cannot rescue, and
 * `@Length` catches input that normalizes away to nothing. */
function slugValue({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? slugify(value) : value;
}

function booleanValue({ value }: TransformFnParams): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

function numberValue({ value }: TransformFnParams): unknown {
  return value === undefined || value === '' ? value : Number(value);
}

export class CreateContinentDto {
  @ApiProperty({ example: 'Europe' })
  @Transform(trimValue)
  @IsString()
  @Length(1, 150)
  name!: string;

  @ApiPropertyOptional({ example: 'europe' })
  @Transform(slugValue)
  @IsOptional()
  @IsString()
  @Length(1, 150)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @ApiPropertyOptional({ example: 'EU' })
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @Length(1, 20)
  @Matches(/^[A-Z0-9_-]+$/)
  code?: string;

  @ApiPropertyOptional({ example: 'European study destinations' })
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  shortDescription?: string;

  @ApiPropertyOptional({ example: false })
  @Transform(booleanValue)
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @Transform(numberValue)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999)
  displayOrder?: number;

  @ApiPropertyOptional({ example: 'ACTIVE', enum: CONTINENT_STATUSES })
  @IsOptional()
  @IsIn(CONTINENT_STATUSES)
  status?: string;
}

export class UpdateContinentDto extends CreateContinentDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  iconMediaId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  heroMediaId?: string;

  @ApiPropertyOptional({
    description: 'Timestamp last displayed by the editor',
  })
  @Transform(trimValue)
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}

export class ContinentListQueryDto {
  @ApiPropertyOptional()
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: CONTINENT_STATUSES })
  @IsOptional()
  @IsIn(CONTINENT_STATUSES)
  status?: string;

  @ApiPropertyOptional({
    enum: ['displayOrder', 'name', 'createdAt', 'updatedAt'],
  })
  @IsOptional()
  @IsIn(['displayOrder', 'name', 'createdAt', 'updatedAt'])
  sort?: string;

  @ApiPropertyOptional({ default: DEFAULT_PAGE })
  @Transform(numberValue)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = DEFAULT_PAGE;

  @ApiPropertyOptional({ default: DEFAULT_LIMIT, maximum: MAX_LIMIT })
  @Transform(numberValue)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit = DEFAULT_LIMIT;
}

export class DeleteContinentDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(trimValue)
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}
