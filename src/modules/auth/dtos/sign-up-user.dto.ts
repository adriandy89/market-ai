import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class SignUpUserDto {
  @ApiProperty({
    description: 'Name',
    example: 'John',
    maxLength: 64,
    minLength: 2,
  })
  @Length(2, 64)
  @IsString()
  @IsNotEmpty()
  readonly name: string;

  @ApiProperty({
    description: 'A valid email address',
    example: 'user@example.com',
    maxLength: 128,
  })
  @Transform(({ value }: { value: string }) => value.toString().toLowerCase())
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(128)
  readonly email: string;

  @ApiProperty({
    description: `A strong password, from 8 to 32 character.
    It must includes at least one uppercase character,
    one lowercase character, number, special character`,
    example: 'As-123456',
    maxLength: 32,
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})/)
  readonly password: string;
}
