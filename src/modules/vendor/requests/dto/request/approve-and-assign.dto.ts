import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ApproveAndAssignDto {
  @ApiProperty({ description: 'Approved quantity' })
  @IsNumber()
  @Min(0)
  approvedQty: number;

  @ApiProperty({ description: 'Approved amount (price)' })
  @IsNumber()
  @Min(0)
  approvedAmount: number;

  @ApiProperty({ description: 'Driver ID to assign' })
  @IsUUID()
  driverId: string;

  @ApiPropertyOptional({ description: 'Approval note' })
  @IsString()
  @IsOptional()
  note?: string;
}
