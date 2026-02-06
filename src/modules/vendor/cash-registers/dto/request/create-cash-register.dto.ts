import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateCashRegisterDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;
}
