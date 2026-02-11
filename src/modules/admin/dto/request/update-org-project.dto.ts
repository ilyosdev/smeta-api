import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

import { ProjectStatus } from 'src/common/database/schemas/projects';

export class UpdateOrgProjectDto {
  @ApiPropertyOptional({ description: 'Project name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'Number of floors' })
  @IsNumber()
  @IsOptional()
  floors?: number;

  @ApiPropertyOptional({ description: 'Budget' })
  @IsNumber()
  @IsOptional()
  budget?: number;

  @ApiPropertyOptional({ enum: ProjectStatus, description: 'Project status' })
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;
}
