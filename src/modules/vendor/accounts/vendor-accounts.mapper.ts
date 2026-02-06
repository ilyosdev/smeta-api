import { Injectable } from '@nestjs/common';

import { Account } from 'src/common/database/schemas';

import { AccountResponseDto, PaginatedAccountResponseDto } from './dto';

@Injectable()
export class VendorAccountsMapper {
  mapAccount(account: Account): AccountResponseDto {
    return {
      id: account.id,
      orgId: account.orgId,
      name: account.name,
      balance: account.balance,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  mapPaginatedAccounts(result: {
    data: Account[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedAccountResponseDto {
    return {
      data: result.data.map((a) => this.mapAccount(a)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
