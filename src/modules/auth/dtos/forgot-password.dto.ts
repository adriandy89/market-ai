import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email address associated with the account',
    example: 'user@example.com',
    maxLength: 128,
  })
  @Transform(({ value }: { value: string }) => value.toString().toLowerCase())
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(128)
  readonly email: string;
}
