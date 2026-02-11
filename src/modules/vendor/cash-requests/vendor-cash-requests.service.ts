import { Injectable } from '@nestjs/common';

import { IUser, Roles } from 'src/common/consts/auth';
import { RequestStatus, DataSource, CashTransactionType } from 'src/common/database/schemas';
import { HandledException } from 'src/common/error/http.error';
import { VendorCashRegistersService } from '../cash-registers/vendor-cash-registers.service';

import { CashRequestWithRelations, VendorCashRequestsRepository } from './vendor-cash-requests.repository';

@Injectable()
export class VendorCashRequestsService {
  constructor(
    private readonly repository: VendorCashRequestsRepository,
    private readonly cashRegistersService: VendorCashRegistersService,
  ) {}

  async create(
    dto: {
      projectId: string;
      amount: number;
      reason?: string;
      neededBy?: Date;
      source: DataSource;
    },
    user: IUser,
  ): Promise<CashRequestWithRelations> {
    const orgId = await this.repository.getProjectOrgId(dto.projectId);

    if (!orgId || orgId !== user.orgId) {
      HandledException.throw('PROJECT_NOT_FOUND', 404);
    }

    const cashRequest = await this.repository.create({
      projectId: dto.projectId,
      requestedById: user.id,
      amount: dto.amount,
      reason: dto.reason,
      neededBy: dto.neededBy,
      source: dto.source,
    });

    return this.findOne(cashRequest.id, user);
  }

  async findAll(
    query: { page?: number; limit?: number; status?: RequestStatus; projectId?: string },
    user: IUser,
  ): Promise<{ data: CashRequestWithRelations[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, status, projectId } = query;
    const result = await this.repository.findAll(user.orgId, { page, limit, status, projectId });
    return { ...result, page, limit };
  }

  async findOne(id: string, user: IUser): Promise<CashRequestWithRelations> {
    const result = await this.repository.findById(id, user.orgId);
    if (!result) {
      HandledException.throw('CASH_REQUEST_NOT_FOUND', 404);
    }
    return result;
  }

  async approve(id: string, user: IUser): Promise<CashRequestWithRelations> {
    const request = await this.findOne(id, user);

    if (request.status !== RequestStatus.PENDING) {
      HandledException.throw('CANNOT_APPROVE_NON_PENDING_REQUEST', 400);
    }

    if (![Roles.BOSS, Roles.DIREKTOR, Roles.BUGALTERIYA].includes(user.role)) {
      HandledException.throw('INSUFFICIENT_PERMISSIONS', 403);
    }

    await this.repository.update(id, {
      status: RequestStatus.APPROVED,
      approvedById: user.id,
      approvedAt: new Date(),
    });

    // Auto-deposit into requester's koshelok, then delete the request
    try {
      const requesterUser: IUser = {
        id: request.requestedById,
        orgId: user.orgId,
        role: Roles.PRORAB,
        telegramId: '',
        name: request.requestedBy?.name || '',
      };
      const koshelok = await this.cashRegistersService.getOrCreateUserKoshelok(requesterUser);
      await this.cashRegistersService.createCashTransaction(
        {
          cashRegisterId: koshelok.id,
          type: CashTransactionType.IN,
          amount: request.amount,
          note: `Pul so'rash — ${request.reason || 'tasdiqlangan'}`,
        },
        requesterUser,
      );
      // Delete the cash request after successful deposit
      await this.repository.delete(id);
    } catch {
      // Non-critical: if deposit/delete fails, request is still approved
    }

    return request as CashRequestWithRelations;
  }

  async reject(
    id: string,
    dto: { rejectionReason?: string },
    user: IUser,
  ): Promise<CashRequestWithRelations> {
    const request = await this.findOne(id, user);

    if (request.status !== RequestStatus.PENDING) {
      HandledException.throw('CANNOT_REJECT_NON_PENDING_REQUEST', 400);
    }

    if (![Roles.BOSS, Roles.DIREKTOR, Roles.BUGALTERIYA].includes(user.role)) {
      HandledException.throw('INSUFFICIENT_PERMISSIONS', 403);
    }

    await this.repository.update(id, {
      status: RequestStatus.REJECTED,
      approvedById: user.id,
      approvedAt: new Date(),
      rejectionReason: dto.rejectionReason,
    });

    return this.findOne(id, user);
  }

  async remove(id: string, user: IUser): Promise<void> {
    const request = await this.findOne(id, user);

    if (request.status !== RequestStatus.PENDING) {
      HandledException.throw('CANNOT_DELETE_NON_PENDING_REQUEST', 400);
    }

    if (request.requestedById !== user.id && ![Roles.BOSS, Roles.DIREKTOR].includes(user.role)) {
      HandledException.throw('CANNOT_DELETE_OTHERS_REQUEST', 403);
    }

    await this.repository.delete(id);
  }
}
