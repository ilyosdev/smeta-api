import { Injectable } from '@nestjs/common';

import { IUser } from 'src/common/consts/auth';
import { CashTransaction, CashTransactionType } from 'src/common/database/schemas';
import { HandledException } from 'src/common/error/http.error';

import { CreateCashRegisterDto, CreateCashTransactionDto, QueryCashRegisterDto, UpdateCashRegisterDto } from './dto';
import { CashRegisterWithRelations, VendorCashRegistersRepository } from './vendor-cash-registers.repository';

@Injectable()
export class VendorCashRegistersService {
  constructor(private readonly repository: VendorCashRegistersRepository) {}

  async createCashRegister(dto: CreateCashRegisterDto, user: IUser): Promise<CashRegisterWithRelations> {
    const userOrgId = await this.repository.getUserOrgId(user.id);
    if (!userOrgId || userOrgId !== user.orgId) {
      HandledException.throw('USER_NOT_FOUND', 404);
    }

    const cashRegister = await this.repository.createCashRegister({
      userId: user.id,
      name: dto.name || 'Asosiy kashlok',
    });

    return this.findOneCashRegister(cashRegister.id, user);
  }

  async findAllCashRegisters(
    query: QueryCashRegisterDto,
    user: IUser,
  ): Promise<{ data: CashRegisterWithRelations[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20 } = query;
    const result = await this.repository.findAllCashRegisters(user.orgId, { page, limit });
    return { ...result, page, limit };
  }

  async findOneCashRegister(id: string, user: IUser): Promise<CashRegisterWithRelations> {
    const result = await this.repository.findCashRegisterById(id, user.orgId);
    if (!result) {
      HandledException.throw('CASH_REGISTER_NOT_FOUND', 404);
    }
    return result;
  }

  async updateCashRegister(id: string, dto: UpdateCashRegisterDto, user: IUser): Promise<CashRegisterWithRelations> {
    await this.findOneCashRegister(id, user);
    await this.repository.updateCashRegister(id, dto);
    return this.findOneCashRegister(id, user);
  }

  async removeCashRegister(id: string, user: IUser): Promise<void> {
    await this.findOneCashRegister(id, user);
    await this.repository.deleteCashRegister(id);
  }

  async createCashTransaction(dto: CreateCashTransactionDto, user: IUser): Promise<CashTransaction> {
    const cashRegisterOrgId = await this.repository.getCashRegisterOrgId(dto.cashRegisterId);
    if (!cashRegisterOrgId || cashRegisterOrgId !== user.orgId) {
      HandledException.throw('CASH_REGISTER_NOT_FOUND', 404);
    }

    const cashRegister = await this.repository.findCashRegisterById(dto.cashRegisterId, user.orgId);
    if (!cashRegister) {
      HandledException.throw('CASH_REGISTER_NOT_FOUND', 404);
    }

    const transaction = await this.repository.createCashTransaction({
      cashRegisterId: dto.cashRegisterId,
      type: dto.type,
      amount: dto.amount,
      note: dto.note,
    });

    const updateData: Partial<{
      balance: number;
      totalIn: number;
      totalOut: number;
    }> = {};

    if (dto.type === CashTransactionType.IN) {
      updateData.balance = cashRegister.balance + dto.amount;
      updateData.totalIn = cashRegister.totalIn + dto.amount;
    } else {
      updateData.balance = cashRegister.balance - dto.amount;
      updateData.totalOut = cashRegister.totalOut + dto.amount;
    }

    await this.repository.updateCashRegister(dto.cashRegisterId, updateData);

    return transaction;
  }

  async findCashTransactions(
    cashRegisterId: string,
    user: IUser,
    page = 1,
    limit = 50,
    filters?: { dateFrom?: Date; dateTo?: Date; type?: CashTransactionType },
  ): Promise<{ data: CashTransaction[]; total: number; page: number; limit: number }> {
    await this.findOneCashRegister(cashRegisterId, user);
    const result = await this.repository.findCashTransactions(cashRegisterId, {
      page,
      limit,
      dateFrom: filters?.dateFrom,
      dateTo: filters?.dateTo,
      type: filters?.type,
    });
    return { ...result, page, limit };
  }

  async getOrCreateUserKoshelok(user: IUser): Promise<CashRegisterWithRelations> {
    const existing = await this.repository.findCashRegisterByUserId(user.id);
    if (existing) return existing;

    const cashRegister = await this.repository.createCashRegister({
      userId: user.id,
      name: 'Koshelok',
    });

    return this.findOneCashRegister(cashRegister.id, user);
  }

  async addToBalance(projectId: string, amount: number, user: IUser): Promise<CashRegisterWithRelations> {
    // Find existing cash register for this project or create one
    let cashRegister = await this.repository.findCashRegisterByProjectId(projectId);

    if (!cashRegister) {
      // Create a cash register for the project
      const newCashRegister = await this.repository.createCashRegister({
        userId: user.id,
        projectId,
        name: 'Loyiha kassasi',
      });
      cashRegister = await this.repository.findCashRegisterById(newCashRegister.id, user.orgId);
    }

    if (!cashRegister) {
      HandledException.throw('CASH_REGISTER_NOT_FOUND', 404);
    }

    // Create an IN transaction
    await this.repository.createCashTransaction({
      cashRegisterId: cashRegister.id,
      type: CashTransactionType.IN,
      amount,
      note: 'Balans to\'ldirish',
    });

    // Update the balance
    await this.repository.updateCashRegister(cashRegister.id, {
      balance: cashRegister.balance + amount,
      totalIn: cashRegister.totalIn + amount,
    });

    return this.findOneCashRegister(cashRegister.id, user);
  }
}
