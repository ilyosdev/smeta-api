import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: '+998901234567' })
  phone?: string;

  @ApiProperty({ example: 'john@example.com' })
  email?: string;

  @ApiProperty({ example: 'BOSS' })
  role: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  orgId: string;

  @ApiProperty({ example: 'My Company' })
  orgName: string;
}

export class TokensResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ type: TokensResponseDto })
  tokens: TokensResponseDto;
}
