import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateAccountDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;
}
