import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { RequestStatus } from 'src/common/database/schemas';

export class CashRequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  requestedById: string;

  @ApiProperty()
  amount: number;

  @ApiPropertyOptional()
  reason: string | null;

  @ApiPropertyOptional()
  neededBy: Date | null;

  @ApiProperty({ enum: RequestStatus })
  status: RequestStatus;

  @ApiPropertyOptional()
  approvedById: string | null;

  @ApiPropertyOptional()
  approvedAt: Date | null;

  @ApiPropertyOptional()
  rejectionReason: string | null;

  @ApiProperty()
  source: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  project?: { id: string; name: string };

  @ApiPropertyOptional()
  requestedBy?: { id: string; name: string };

  @ApiPropertyOptional()
  approvedBy?: { id: string; name: string } | null;
}

export class PaginatedCashRequestResponseDto {
  @ApiProperty({ type: [CashRequestResponseDto] })
  data: CashRequestResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
