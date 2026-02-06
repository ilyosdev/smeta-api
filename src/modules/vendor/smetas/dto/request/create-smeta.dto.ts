import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

import { SmetaType } from 'src/common/database/schemas';

export class CreateSmetaDto {
  @ApiProperty({ description: 'Project ID' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ description: 'Smeta name', example: 'Foundation Works' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ enum: SmetaType, default: SmetaType.CONSTRUCTION })
  @IsEnum(SmetaType)
  @IsOptional()
  type?: SmetaType;

  @ApiPropertyOptional({ description: 'Overhead percentage', example: 17.27, default: 17.27 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  overheadPercent?: number;
}
