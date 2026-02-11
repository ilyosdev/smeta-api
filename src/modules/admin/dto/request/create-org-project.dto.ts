import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateOrgProjectDto {
  @ApiProperty({ description: 'Project name', example: 'Navoiy 108-uy' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Address', example: 'Toshkent sh.' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'Number of floors', example: 9 })
  @IsNumber()
  @IsOptional()
  floors?: number;

  @ApiPropertyOptional({ description: 'Budget', example: 1000000 })
  @IsNumber()
  @IsOptional()
  budget?: number;
}
