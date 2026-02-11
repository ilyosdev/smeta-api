import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ description: 'Organization name', example: 'BuildCorp' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+998901234567' })
  @IsString()
  @IsOptional()
  phone?: string;
}
