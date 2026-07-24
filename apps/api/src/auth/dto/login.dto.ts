import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @Transform(({ value }: TransformFnParams) => {
    const safeValue: unknown = value;
    return typeof safeValue === 'string' ? safeValue.trim() : safeValue;
  })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'your-password', minLength: 1 })
  @IsString()
  @MinLength(1)
  password!: string;
}
