import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestUserDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;
}

export class RequestSmetaItemDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Cement' })
  name: string;

  @ApiProperty({ example: 'kg' })
  unit: string;

  @ApiProperty({ example: 1000 })
  quantity: number;

  @ApiProperty({ example: 500 })
  unitPrice: number;
}

export class RequestResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  smetaItemId: string;

  @ApiProperty({ example: 100 })
  requestedQty: number;

  @ApiProperty({ example: 50000 })
  requestedAmount: number;

  @ApiPropertyOptional({ example: 'Urgent order needed' })
  note?: string;

  @ApiProperty({ example: 'PENDING' })
  status: string;

  @ApiProperty({ example: 'DASHBOARD' })
  source: string;

  @ApiProperty({ example: false })
  isOverrun: boolean;

  @ApiPropertyOptional({ example: 10 })
  overrunQty?: number;

  @ApiPropertyOptional({ example: 5.5 })
  overrunPercent?: number;

  @ApiPropertyOptional({ example: 'Not enough budget' })
  rejectionReason?: string;

  @ApiPropertyOptional({ example: '2024-01-15T10:30:00.000Z' })
  approvedAt?: Date;

  @ApiPropertyOptional({ type: RequestUserDto })
  requestedBy?: RequestUserDto;

  @ApiPropertyOptional({ type: RequestUserDto })
  approvedBy?: RequestUserDto;

  @ApiPropertyOptional({ type: RequestSmetaItemDto })
  smetaItem?: RequestSmetaItemDto;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  updatedAt: Date;
}

export class PaginatedRequestResponseDto {
  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ type: [RequestResponseDto] })
  data: RequestResponseDto[];
}
