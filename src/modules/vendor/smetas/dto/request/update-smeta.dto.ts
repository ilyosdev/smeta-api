import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import { SmetaType } from 'src/common/database/schemas';

export class UpdateSmetaDto {
  @ApiPropertyOptional({ description: 'Smeta name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: SmetaType })
  @IsEnum(SmetaType)
  @IsOptional()
  type?: SmetaType;

  @ApiPropertyOptional({ description: 'Overhead percentage' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  overheadPercent?: number;
}
