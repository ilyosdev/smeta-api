import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

import { ProjectStatus } from 'src/common/database/schemas';

export class CreateProjectDto {
  @ApiProperty({ description: 'Project name', example: 'Residential Complex A' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Total budget', example: 1000000 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  budget?: number;

  @ApiPropertyOptional({ description: 'Address', example: 'Tashkent, Chilanzar' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'Number of floors', example: 9 })
  @IsInt()
  @IsOptional()
  @Min(1)
  floors?: number;

  @ApiPropertyOptional({ enum: ProjectStatus, default: ProjectStatus.PLANNING })
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;
}
