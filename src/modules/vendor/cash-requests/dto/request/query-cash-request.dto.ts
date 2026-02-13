import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

import { CashRequestStatus } from 'src/common/database/schemas';

export class QueryCashRequestDto {
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ enum: CashRequestStatus })
  @IsEnum(CashRequestStatus)
  @IsOptional()
  status?: CashRequestStatus;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  projectId?: string;
}
