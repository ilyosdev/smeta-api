import { ApiProperty } from '@nestjs/swagger';

export class AccountResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orgId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  balance: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedAccountResponseDto {
  @ApiProperty({ type: [AccountResponseDto] })
  data: AccountResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
