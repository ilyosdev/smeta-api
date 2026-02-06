import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TelegramGroupResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  chatId: string;

  @ApiPropertyOptional()
  title: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  joinedAt: Date;

  @ApiPropertyOptional()
  project?: {
    id: string;
    name: string;
  };
}

export class PaginatedTelegramGroupResponseDto {
  @ApiProperty({ type: [TelegramGroupResponseDto] })
  data: TelegramGroupResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
