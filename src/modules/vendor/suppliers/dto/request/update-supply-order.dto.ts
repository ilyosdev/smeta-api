import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { SupplyOrderStatus } from 'src/common/database/schemas';

export class UpdateSupplyOrderDto {
  @ApiPropertyOptional({ enum: SupplyOrderStatus })
  @IsEnum(SupplyOrderStatus)
  @IsOptional()
  status?: SupplyOrderStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;
}
