import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MASTER_STATUSES,
  MAX_LIMIT,
} from '../../catalog/catalog.constants';

const trim = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;
const num = ({ value }: TransformFnParams) =>
  value === undefined || value === '' ? value : Number(value);
export class MasterFieldsDto {
  @ApiProperty({ example: 'UG' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(1, 30)
  @Matches(/^[A-Z0-9_-]+$/)
  code!: string;
  @ApiProperty({ example: 'Undergraduate' })
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name!: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
  @ApiPropertyOptional()
  @Transform(num)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999)
  educationOrder?: number;
  @ApiPropertyOptional()
  @Transform(num)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999)
  displayOrder?: number;
  @ApiPropertyOptional({ enum: MASTER_STATUSES })
  @IsOptional()
  @IsIn(MASTER_STATUSES)
  status?: string;
}
export class CreateMasterDto extends MasterFieldsDto {}
export class UpdateMasterDto extends MasterFieldsDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}
export class MasterActionDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}
export class MasterListQueryDto {
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
  @ApiPropertyOptional({ enum: MASTER_STATUSES })
  @IsOptional()
  @IsIn(MASTER_STATUSES)
  status?: string;
  @ApiPropertyOptional() @Transform(num) @IsOptional() @IsInt() @Min(1) page =
    DEFAULT_PAGE;
  @ApiPropertyOptional({ maximum: MAX_LIMIT })
  @Transform(num)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit = DEFAULT_LIMIT;
}
