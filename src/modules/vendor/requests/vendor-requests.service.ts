import { Injectable } from '@nestjs/common';

import { IUser, Roles } from 'src/common/consts/auth';
import { RequestStatus } from 'src/common/database/schemas';
import { HandledException } from 'src/common/error/http.error';

import { CreateRequestDto, QueryRequestDto, UpdateRequestDto, RejectRequestDto, FulfillRequestDto } from './dto';
import { RequestWithRelations, VendorRequestsRepository } from './vendor-requests.repository';

@Injectable()
export class VendorRequestsService {
  constructor(private readonly repository: VendorRequestsRepository) {}

  async create(dto: CreateRequestDto, user: IUser): Promise<RequestWithRelations> {
    const smetaItemOrgId = await this.repository.getSmetaItemOrgId(dto.smetaItemId);

    if (!smetaItemOrgId || smetaItemOrgId !== user.orgId) {
      HandledException.throw('SMETA_ITEM_NOT_FOUND', 404);
    }

    const request = await this.repository.create({
      smetaItemId: dto.smetaItemId,
      requestedQty: dto.requestedQty,
      requestedAmount: dto.requestedAmount,
      note: dto.note,
      source: dto.source,
      isOverrun: dto.isOverrun ?? false,
      overrunQty: dto.overrunQty,
      overrunPercent: dto.overrunPercent,
      requestedById: user.id,
    });

    return this.findOne(request.id, user);
  }

  async findAll(
    query: QueryRequestDto,
    user: IUser,
  ): Promise<{ data: RequestWithRelations[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, status, statuses, smetaItemId, projectId } = query;
    const result = await this.repository.findAll(user.orgId, {
      page,
      limit,
      status,
      statuses,
      smetaItemId,
      projectId,
    });
    return { ...result, page, limit };
  }

  async findOne(id: string, user: IUser): Promise<RequestWithRelations> {
    const result = await this.repository.findById(id, user.orgId);

    if (!result) {
      HandledException.throw('REQUEST_NOT_FOUND', 404);
    }

    return result;
  }

  async update(id: string, dto: UpdateRequestDto, user: IUser): Promise<RequestWithRelations> {
    const request = await this.findOne(id, user);

    if (request.status !== RequestStatus.PENDING) {
      HandledException.throw('CANNOT_UPDATE_NON_PENDING_REQUEST', 400);
    }

    await this.repository.update(id, {
      requestedQty: dto.requestedQty,
      requestedAmount: dto.requestedAmount,
      note: dto.note,
      isOverrun: dto.isOverrun,
      overrunQty: dto.overrunQty,
      overrunPercent: dto.overrunPercent,
    });

    return this.findOne(id, user);
  }

  async approve(id: string, user: IUser): Promise<RequestWithRelations> {
    const request = await this.findOne(id, user);

    if (request.status !== RequestStatus.PENDING) {
      HandledException.throw('CANNOT_APPROVE_NON_PENDING_REQUEST', 400);
    }

    if (![Roles.BOSS, Roles.DIREKTOR, Roles.BUGALTERIYA, Roles.SNABJENIYA].includes(user.role)) {
      HandledException.throw('INSUFFICIENT_PERMISSIONS', 403);
    }

    await this.repository.update(id, {
      status: RequestStatus.APPROVED,
      approvedById: user.id,
      approvedAt: new Date(),
    });

    return this.findOne(id, user);
  }

  async reject(id: string, dto: RejectRequestDto, user: IUser): Promise<RequestWithRelations> {
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

  async fulfill(id: string, dto: FulfillRequestDto, user: IUser): Promise<RequestWithRelations> {
    const request = await this.findOne(id, user);

    if (request.status !== RequestStatus.PENDING && request.status !== RequestStatus.APPROVED) {
      HandledException.throw('CANNOT_FULFILL_REQUEST', 400);
    }

    if (![Roles.SNABJENIYA, Roles.BOSS, Roles.DIREKTOR].includes(user.role)) {
      HandledException.throw('INSUFFICIENT_PERMISSIONS', 403);
    }

    await this.repository.update(id, {
      status: RequestStatus.FULFILLED,
      fulfilledQty: dto.fulfilledQty,
      fulfilledAmount: dto.fulfilledAmount,
      supplierName: dto.supplierName,
      proofPhotoFileId: dto.proofPhotoFileId,
      fulfilledById: user.id,
      fulfilledAt: new Date(),
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
