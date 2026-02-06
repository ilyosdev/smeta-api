import { Injectable } from '@nestjs/common';

import { CashTransaction } from 'src/common/database/schemas';

import {
  CashRegisterResponseDto,
  CashTransactionResponseDto,
  PaginatedCashRegisterResponseDto,
  PaginatedCashTransactionResponseDto,
} from './dto';
import { CashRegisterWithRelations } from './vendor-cash-registers.repository';

@Injectable()
export class VendorCashRegistersMapper {
  mapCashRegister(cashRegister: CashRegisterWithRelations): CashRegisterResponseDto {
    return {
      id: cashRegister.id,
      userId: cashRegister.userId,
      name: cashRegister.name,
      balance: cashRegister.balance,
      totalIn: cashRegister.totalIn,
      totalOut: cashRegister.totalOut,
      createdAt: cashRegister.createdAt,
      updatedAt: cashRegister.updatedAt,
      user: cashRegister.user,
    };
  }

  mapPaginatedCashRegisters(result: {
    data: CashRegisterWithRelations[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedCashRegisterResponseDto {
    return {
      data: result.data.map((cr) => this.mapCashRegister(cr)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  mapCashTransaction(transaction: CashTransaction): CashTransactionResponseDto {
    return {
      id: transaction.id,
      cashRegisterId: transaction.cashRegisterId,
      type: transaction.type,
      amount: transaction.amount,
      note: transaction.note,
      createdAt: transaction.createdAt,
    };
  }

  mapPaginatedCashTransactions(result: {
    data: CashTransaction[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedCashTransactionResponseDto {
    return {
      data: result.data.map((t) => this.mapCashTransaction(t)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
