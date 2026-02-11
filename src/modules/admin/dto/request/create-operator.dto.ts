import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateOperatorDto {
  @ApiProperty({ description: 'Operator name', example: 'Operator User' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Phone number', example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ description: 'Password (min 6 chars)', example: 'secret123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ description: 'Organization IDs to assign', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  orgIds?: string[];
}
