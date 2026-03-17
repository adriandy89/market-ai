import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsString, Max, Min, ArrayMaxSize, MaxLength } from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty() @IsString() @MaxLength(100)
  label: string;

  @ApiProperty() @IsBoolean()
  enabled: boolean;

  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) @ArrayMaxSize(50)
  symbols: string[];

  @ApiProperty() @IsInt() @Min(0) @Max(23)
  cronHour: number;

  @ApiProperty() @IsInt() @Min(0) @Max(59)
  cronMinute: number;
}
