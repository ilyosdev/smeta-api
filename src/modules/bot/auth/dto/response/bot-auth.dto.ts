import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BotUserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiPropertyOptional({ example: '123456789' })
  telegramId?: string;

  @ApiProperty({ example: 'PRORAB' })
  role: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  orgId: string;
}

export class BotTokensResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;
}

export class BotAuthResponseDto {
  @ApiProperty({ type: BotUserResponseDto })
  user: BotUserResponseDto;

  @ApiProperty({ type: BotTokensResponseDto })
  tokens: BotTokensResponseDto;
}
