import { Injectable } from '@nestjs/common';

import { IUser } from 'src/common/consts/auth';
import { Worker, WorkLog, WorkerPayment } from 'src/common/database/schemas';
import { HandledException } from 'src/common/error/http.error';

import {
  CreateWorkerDto,
  CreateWorkLogDto,
  CreateWorkerPaymentDto,
  QueryWorkerDto,
  UpdateWorkerDto,
  ValidateWorkLogDto,
} from './dto';
import {
  VendorWorkersRepository,
  WorkLogWithRelations,
  WorkerPaymentWithRelations,
} from './vendor-workers.repository';

@Injectable()
export class VendorWorkersService {
  constructor(private readonly repository: VendorWorkersRepository) {}

  async createWorker(dto: CreateWorkerDto, user: IUser): Promise<Worker> {
    return this.repository.createWorker({
      orgId: user.orgId,
      name: dto.name,
      phone: dto.phone,
      specialty: dto.specialty,
      userId: (dto as any).userId,
    });
  }

  async findWorkerByUserId(userId: string, user: IUser): Promise<Worker | null> {
    return this.repository.findWorkerByUserId(userId, user.orgId);
  }

  async findAllWorkers(
    query: QueryWorkerDto,
    user: IUser,
  ): Promise<{ data: Worker[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, search } = query;
    const result = await this.repository.findAllWorkers(user.orgId, { page, limit, search });
    return { ...result, page, limit };
  }

  async findOneWorker(id: string, user: IUser): Promise<Worker> {
    const result = await this.repository.findWorkerById(id, user.orgId);
    if (!result) {
      HandledException.throw('WORKER_NOT_FOUND', 404);
    }
    return result;
  }

  async updateWorker(id: string, dto: UpdateWorkerDto, user: IUser): Promise<Worker> {
    await this.findOneWorker(id, user);
    return this.repository.updateWorker(id, dto);
  }

  async removeWorker(id: string, user: IUser): Promise<void> {
    await this.findOneWorker(id, user);
    await this.repository.deleteWorker(id);
  }

  async createWorkLog(dto: CreateWorkLogDto, user: IUser): Promise<WorkLogWithRelations> {
    const projectOrgId = await this.repository.getProjectOrgId(dto.projectId);
    if (!projectOrgId || projectOrgId !== user.orgId) {
      HandledException.throw('PROJECT_NOT_FOUND', 404);
    }

    if (dto.workerId) {
      const workerOrgId = await this.repository.getWorkerOrgId(dto.workerId);
      if (!workerOrgId || workerOrgId !== user.orgId) {
        HandledException.throw('WORKER_NOT_FOUND', 404);
      }
    }

    const totalAmount = dto.unitPrice ? dto.quantity * dto.unitPrice : null;

    const workLog = await this.repository.createWorkLog({
      projectId: dto.projectId,
      workerId: dto.workerId,
      smetaItemId: dto.smetaItemId,
      workType: dto.workType,
      unit: dto.unit,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      totalAmount,
      date: dto.date ? new Date(dto.date) : new Date(),
      loggedById: user.id,
    });

    return this.findOneWorkLog(workLog.id, user);
  }

  async findAllWorkLogs(
    user: IUser,
    page = 1,
    limit = 20,
    workerId?: string,
    projectId?: string,
  ): Promise<{ data: WorkLogWithRelations[]; total: number; page: number; limit: number }> {
    const result = await this.repository.findWorkLogs(user.orgId, { page, limit, workerId, projectId });
    return { ...result, page, limit };
  }

  async findUnpaidWorkLogs(
    user: IUser,
    page = 1,
    limit = 20,
    projectId?: string,
  ): Promise<{ data: WorkLogWithRelations[]; total: number; page: number; limit: number }> {
    const result = await this.repository.findWorkLogs(user.orgId, { page, limit, projectId, isPaid: false });
    return { ...result, page, limit };
  }

  async findOneWorkLog(id: string, user: IUser): Promise<WorkLogWithRelations> {
    const result = await this.repository.findWorkLogById(id, user.orgId);
    if (!result) {
      HandledException.throw('WORK_LOG_NOT_FOUND', 404);
    }
    return result;
  }

  async validateWorkLog(id: string, dto: ValidateWorkLogDto, user: IUser): Promise<WorkLogWithRelations> {
    const workLog = await this.findOneWorkLog(id, user);

    if (workLog.isValidated) {
      HandledException.throw('WORK_LOG_ALREADY_VALIDATED', 400);
    }

    const unitPrice = dto.unitPrice ?? workLog.unitPrice;
    const totalAmount = dto.totalAmount ?? (unitPrice ? workLog.quantity * unitPrice : null);

    await this.repository.updateWorkLog(id, {
      isValidated: true,
      validatedById: user.id,
      validatedAt: new Date(),
      unitPrice,
      totalAmount,
    });

    if (workLog.workerId && totalAmount) {
      const worker = await this.repository.findWorkerById(workLog.workerId, user.orgId);
      if (worker) {
        await this.repository.updateWorker(worker.id, {
          totalEarned: worker.totalEarned + totalAmount,
        });
      }
    }

    return this.findOneWorkLog(id, user);
  }

  async deleteWorkLog(id: string, user: IUser): Promise<void> {
    const workLog = await this.findOneWorkLog(id, user);

    if (workLog.isValidated && workLog.workerId && workLog.totalAmount) {
      const worker = await this.repository.findWorkerById(workLog.workerId, user.orgId);
      if (worker) {
        await this.repository.updateWorker(worker.id, {
          totalEarned: Math.max(0, worker.totalEarned - workLog.totalAmount),
        });
      }
    }

    await this.repository.deleteWorkLog(id);
  }

  async createPayment(dto: CreateWorkerPaymentDto, user: IUser): Promise<WorkerPaymentWithRelations> {
    const worker = await this.findOneWorker(dto.workerId, user);

    const payment = await this.repository.createPayment({
      workerId: dto.workerId,
      amount: dto.amount,
      note: dto.note,
      paidById: user.id,
    });

    await this.repository.updateWorker(worker.id, {
      totalPaid: worker.totalPaid + dto.amount,
    });

    return this.findOnePayment(payment.id, user);
  }

  async findAllPayments(
    user: IUser,
    page = 1,
    limit = 20,
    workerId?: string,
  ): Promise<{ data: WorkerPaymentWithRelations[]; total: number; page: number; limit: number }> {
    const result = await this.repository.findPayments(user.orgId, { page, limit, workerId });
    return { ...result, page, limit };
  }

  async findOnePayment(id: string, user: IUser): Promise<WorkerPaymentWithRelations> {
    const result = await this.repository.findPaymentById(id, user.orgId);
    if (!result) {
      HandledException.throw('PAYMENT_NOT_FOUND', 404);
    }
    return result;
  }

  async findValidatedUnpaidWorkLogs(
    user: IUser,
    workerId: string,
    projectId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: WorkLogWithRelations[]; total: number; page: number; limit: number }> {
    const result = await this.repository.findValidatedUnpaidWorkLogs(user.orgId, { workerId, projectId, page, limit });
    return { ...result, page, limit };
  }

  async markWorkLogPaid(id: string, user: IUser): Promise<void> {
    await this.findOneWorkLog(id, user);
    await this.repository.markWorkLogPaid(id);
  }

  async findUnvalidatedWorkLogs(
    user: IUser,
    page = 1,
    limit = 20,
    projectId?: string,
  ): Promise<{ data: WorkLogWithRelations[]; total: number; page: number; limit: number }> {
    const result = await this.repository.findUnvalidatedWorkLogs(user.orgId, { page, limit, projectId });
    return { ...result, page, limit };
  }
}
