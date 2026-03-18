import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { AlertDirection, AlertType } from 'generated/prisma/enums';

export class CreateAlertDto {
  @ApiProperty() @IsString() @MaxLength(20)
  symbol: string;

  @ApiProperty() @IsString() @MaxLength(128)
  name: string;

  @ApiProperty({ enum: AlertType })
  @IsEnum(AlertType)
  alertType: AlertType;

  @ApiProperty({ enum: AlertDirection })
  @IsEnum(AlertDirection)
  direction: AlertDirection;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.alertType !== 'FIXED_PRICE')
  @IsNumber()
  @Min(0.1)
  @Max(100)
  thresholdPercent?: number;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.alertType === 'FIXED_PRICE')
  @IsNumber()
  @Min(0)
  thresholdPrice?: number;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.alertType === 'PERCENTAGE_CHANGE_WINDOW')
  @IsNumber()
  @Min(1)
  @Max(168)
  timeWindowHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}
