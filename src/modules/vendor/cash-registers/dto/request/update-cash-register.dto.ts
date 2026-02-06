import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateCashRegisterDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;
}
