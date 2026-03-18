import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { AlertDirection } from 'generated/prisma/enums';

export class UpdateAlertDto {
  @ApiPropertyOptional({ enum: AlertDirection })
  @IsOptional()
  @IsEnum(AlertDirection)
  direction?: AlertDirection;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  thresholdPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  thresholdPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  timeWindowHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}
