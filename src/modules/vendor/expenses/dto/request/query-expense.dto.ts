import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { ExpenseCategory } from 'src/common/database/schemas';

export class QueryExpenseDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ enum: ExpenseCategory })
  @IsEnum(ExpenseCategory)
  @IsOptional()
  category?: ExpenseCategory;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
