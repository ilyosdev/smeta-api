import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectCashRequestDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
