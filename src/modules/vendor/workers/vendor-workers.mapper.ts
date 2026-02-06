import { Injectable } from '@nestjs/common';

import { Worker } from 'src/common/database/schemas';

import {
  PaginatedWorkerPaymentResponseDto,
  PaginatedWorkerResponseDto,
  PaginatedWorkLogResponseDto,
  WorkerPaymentResponseDto,
  WorkerResponseDto,
  WorkLogResponseDto,
} from './dto';
import { WorkLogWithRelations, WorkerPaymentWithRelations } from './vendor-workers.repository';

@Injectable()
export class VendorWorkersMapper {
  mapWorker(worker: Worker): WorkerResponseDto {
    return {
      id: worker.id,
      name: worker.name,
      phone: worker.phone,
      specialty: worker.specialty,
      totalEarned: worker.totalEarned,
      totalPaid: worker.totalPaid,
      balance: worker.totalEarned - worker.totalPaid,
      createdAt: worker.createdAt,
      updatedAt: worker.updatedAt,
    };
  }

  mapPaginatedWorkers(result: {
    data: Worker[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedWorkerResponseDto {
    return {
      data: result.data.map((w) => this.mapWorker(w)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  mapWorkLog(workLog: WorkLogWithRelations): WorkLogResponseDto {
    return {
      id: workLog.id,
      workType: workLog.workType,
      unit: workLog.unit,
      quantity: workLog.quantity,
      unitPrice: workLog.unitPrice,
      totalAmount: workLog.totalAmount,
      date: workLog.date,
      isValidated: workLog.isValidated,
      validatedAt: workLog.validatedAt,
      worker: workLog.worker ?? undefined,
      project: workLog.project,
      smetaItem: workLog.smetaItem ?? undefined,
      loggedBy: workLog.loggedBy,
      validatedBy: workLog.validatedBy,
      createdAt: workLog.createdAt,
    };
  }

  mapPaginatedWorkLogs(result: {
    data: WorkLogWithRelations[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedWorkLogResponseDto {
    return {
      data: result.data.map((wl) => this.mapWorkLog(wl)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  mapPayment(payment: WorkerPaymentWithRelations): WorkerPaymentResponseDto {
    return {
      id: payment.id,
      amount: payment.amount,
      note: payment.note,
      worker: payment.worker,
      paidBy: payment.paidBy,
      createdAt: payment.createdAt,
    };
  }

  mapPaginatedPayments(result: {
    data: WorkerPaymentWithRelations[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedWorkerPaymentResponseDto {
    return {
      data: result.data.map((p) => this.mapPayment(p)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
