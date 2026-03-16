import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'OldPass-123',
  })
  @IsString()
  @IsNotEmpty()
  readonly currentPassword: string;

  @ApiProperty({
    description: `New password, 8 to 32 characters. Must include uppercase, lowercase, number, special character`,
    example: 'NewPass-456',
    minLength: 8,
    maxLength: 32,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})/)
  readonly newPassword: string;
}
