import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: TransformFnParams) => {
  const safe: unknown = value;
  return typeof safe === 'string' ? safe.trim() : safe;
};

/** Mirrors the policy the admin seed enforces: length plus a mix, so a short
 * dictionary word cannot protect an account holding passport details. */
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[\s\S]{12,}$/;
const PASSWORD_MESSAGE =
  'Password must be at least 12 characters and include an uppercase letter, a lowercase letter and a number';

/**
 * Registration input.
 *
 * There is deliberately no role, roleId, permissions or status field here.
 * With `forbidNonWhitelisted` validation the request is rejected outright if a
 * caller invents one, so privilege escalation has nothing to attach to.
 */
export class StudentRegisterDto {
  @ApiProperty({ example: 'Rahul' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiPropertyOptional({ example: 'Sharma' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({ example: 'rahul@example.com' })
  @Transform(trim)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional({ example: '+91' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(10)
  phoneCountryCode?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @Matches(PASSWORD_POLICY, { message: PASSWORD_MESSAGE })
  password!: string;
}

export class StudentLoginDto {
  @ApiProperty({ example: 'rahul@example.com' })
  @Transform(trim)
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;
}

export class StudentEmailDto {
  @ApiProperty({ example: 'rahul@example.com' })
  @Transform(trim)
  @IsEmail()
  email!: string;
}

export class StudentVerifyEmailDto {
  @ApiProperty()
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string;
}

export class StudentResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @Matches(PASSWORD_POLICY, { message: PASSWORD_MESSAGE })
  password!: string;
}
