import { Injectable } from '@nestjs/common';

import { IUser } from 'src/common/consts/auth';
import { Account } from 'src/common/database/schemas';
import { HandledException } from 'src/common/error/http.error';

import { CreateAccountDto, QueryAccountDto, UpdateAccountDto } from './dto';
import { VendorAccountsRepository } from './vendor-accounts.repository';

@Injectable()
export class VendorAccountsService {
  constructor(private readonly repository: VendorAccountsRepository) {}

  async createAccount(dto: CreateAccountDto, user: IUser): Promise<Account> {
    return this.repository.createAccount({
      orgId: user.orgId,
      name: dto.name,
      balance: 0,
    });
  }

  async findAllAccounts(
    query: QueryAccountDto,
    user: IUser,
  ): Promise<{ data: Account[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, search } = query;
    const result = await this.repository.findAllAccounts(user.orgId, { page, limit, search });
    return { ...result, page, limit };
  }

  async findOneAccount(id: string, user: IUser): Promise<Account> {
    const result = await this.repository.findAccountById(id, user.orgId);
    if (!result) {
      HandledException.throw('ACCOUNT_NOT_FOUND', 404);
    }
    return result;
  }

  async updateAccount(id: string, dto: UpdateAccountDto, user: IUser): Promise<Account> {
    await this.findOneAccount(id, user);
    return this.repository.updateAccount(id, dto);
  }

  async removeAccount(id: string, user: IUser): Promise<void> {
    await this.findOneAccount(id, user);
    await this.repository.deleteAccount(id);
  }
}
