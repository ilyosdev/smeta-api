import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateWorkLogDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  workerId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  smetaItemId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  workType: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiProperty()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  date?: string;
}
