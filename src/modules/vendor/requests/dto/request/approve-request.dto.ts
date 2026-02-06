import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveRequestDto {
  @ApiPropertyOptional({ description: 'Approval note' })
  @IsString()
  @IsOptional()
  note?: string;
}

export class RejectRequestDto {
  @ApiPropertyOptional({ description: 'Rejection reason' })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
