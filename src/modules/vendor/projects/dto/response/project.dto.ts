import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProjectResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Residential Complex A' })
  name: string;

  @ApiPropertyOptional({ example: 'Multi-story residential building' })
  description?: string;

  @ApiPropertyOptional({ example: 1000000 })
  budget?: number;

  @ApiProperty({ example: 'PLANNING' })
  status: string;

  @ApiPropertyOptional({ example: 'Tashkent, Chilanzar' })
  address?: string;

  @ApiPropertyOptional({ example: 9 })
  floors?: number;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  updatedAt: Date;
}

export class PaginatedProjectResponseDto {
  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ type: [ProjectResponseDto] })
  data: ProjectResponseDto[];
}
