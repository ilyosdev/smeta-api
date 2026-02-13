import { Injectable } from '@nestjs/common';

import { IUser, Roles } from 'src/common/consts/auth';
import { RequestStatus } from 'src/common/database/schemas';
import { HandledException } from 'src/common/error/http.error';

import {
  CreateRequestDto,
  QueryRequestDto,
  UpdateRequestDto,
  RejectRequestDto,
  FulfillRequestDto,
  ApproveAndAssignDto,
  MarkCollectedDto,
  MarkDeliveredDto,
  ConfirmReceiptDto,
  FinalizeRequestDto,
} from './dto';
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

  /**
   * SNABJENIYA approves a request with qty/price edits and assigns a driver
   */
  async approveAndAssign(id: string, dto: ApproveAndAssignDto, user: IUser): Promise<RequestWithRelations> {
    const request = await this.findOne(id, user);

    if (request.status !== RequestStatus.PENDING) {
      HandledException.throw('CANNOT_APPROVE_NON_PENDING_REQUEST', 400);
    }

    if (![Roles.SNABJENIYA, Roles.BOSS, Roles.DIREKTOR].includes(user.role)) {
      HandledException.throw('INSUFFICIENT_PERMISSIONS', 403);
    }

    await this.repository.update(id, {
      status: RequestStatus.APPROVED,
      approvedById: user.id,
      approvedAt: new Date(),
      approvedQty: dto.approvedQty,
      approvedAmount: dto.approvedAmount,
      assignedDriverId: dto.driverId,
      assignedAt: new Date(),
    });

    return this.findOne(id, user);
  }

  /**
   * HAYDOVCHI marks that materials have been collected
   */
  async markCollected(id: string, dto: MarkCollectedDto, user: IUser): Promise<RequestWithRelations> {
    const request = await this.findOne(id, user);

    if (request.status !== RequestStatus.APPROVED) {
      HandledException.throw('CANNOT_COLLECT_NOT_APPROVED_REQUEST', 400);
    }

    if (request.assignedDriverId !== user.id && ![Roles.BOSS, Roles.DIREKTOR].includes(user.role)) {
      HandledException.throw('NOT_ASSIGNED_DRIVER', 403);
    }

    await this.repository.update(id, {
      status: RequestStatus.IN_TRANSIT,
      collectedQty: dto.collectedQty,
      collectedAt: new Date(),
      collectionNote: dto.note,
      collectionPhotoFileId: dto.photoFileId,
    });

    return this.findOne(id, user);
  }

  /**
   * HAYDOVCHI marks that materials have been delivered to warehouse
   */
  async markDelivered(id: string, dto: MarkDeliveredDto, user: IUser): Promise<RequestWithRelations> {
    const request = await this.findOne(id, user);

    if (request.status !== RequestStatus.IN_TRANSIT) {
      HandledException.throw('CANNOT_DELIVER_NOT_IN_TRANSIT_REQUEST', 400);
    }

    if (request.assignedDriverId !== user.id && ![Roles.BOSS, Roles.DIREKTOR].includes(user.role)) {
      HandledException.throw('NOT_ASSIGNED_DRIVER', 403);
    }

    await this.repository.update(id, {
      status: RequestStatus.DELIVERED,
      deliveredQty: dto.deliveredQty,
      deliveredAt: new Date(),
      deliveryNote: dto.note,
      deliveryPhotoFileId: dto.photoFileId,
    });

    return this.findOne(id, user);
  }

  /**
   * SKLAD confirms receipt of delivered materials (goes to RECEIVED, waiting for MODERATOR)
   */
  async confirmReceipt(id: string, dto: ConfirmReceiptDto, user: IUser): Promise<RequestWithRelations> {
    const request = await this.findOne(id, user);

    if (request.status !== RequestStatus.DELIVERED) {
      HandledException.throw('CANNOT_RECEIVE_NOT_DELIVERED_REQUEST', 400);
    }

    if (![Roles.SKLAD, Roles.BOSS, Roles.DIREKTOR].includes(user.role)) {
      HandledException.throw('INSUFFICIENT_PERMISSIONS', 403);
    }

    await this.repository.update(id, {
      status: RequestStatus.RECEIVED,
      receivedQty: dto.receivedQty,
      receivedById: user.id,
      receivedAt: new Date(),
      receiptNote: dto.note,
      receiptPhotoFileId: dto.photoFileId,
    });

    return this.findOne(id, user);
  }

  /**
   * MODERATOR finalizes prices for received materials
   */
  async finalize(id: string, dto: FinalizeRequestDto, user: IUser): Promise<RequestWithRelations> {
    const request = await this.findOne(id, user);

    if (request.status !== RequestStatus.RECEIVED) {
      HandledException.throw('CANNOT_FINALIZE_NOT_RECEIVED_REQUEST', 400);
    }

    if (![Roles.MODERATOR, Roles.BOSS, Roles.DIREKTOR].includes(user.role)) {
      HandledException.throw('INSUFFICIENT_PERMISSIONS', 403);
    }

    // Calculate unit price if not provided
    const finalUnitPrice = dto.finalUnitPrice ?? (request.receivedQty ? dto.finalAmount / request.receivedQty : dto.finalAmount);

    await this.repository.update(id, {
      status: RequestStatus.FULFILLED,
      finalAmount: dto.finalAmount,
      finalUnitPrice,
      finalizedById: user.id,
      finalizedAt: new Date(),
      finalizationNote: dto.note,
      // Also set fulfilled fields for backward compatibility
      fulfilledQty: request.receivedQty,
      fulfilledAmount: dto.finalAmount,
      fulfilledById: user.id,
      fulfilledAt: new Date(),
    });

    return this.findOne(id, user);
  }

  /**
   * Find requests in RECEIVED status waiting for moderator finalization
   */
  async findPendingFinalization(
    projectId: string | undefined,
    user: IUser,
  ): Promise<{ data: RequestWithRelations[]; total: number }> {
    return this.repository.findAll(user.orgId, {
      page: 1,
      limit: 50,
      status: RequestStatus.RECEIVED,
      projectId,
    });
  }

  /**
   * Find requests assigned to a specific driver
   */
  async findByDriver(
    driverId: string,
    status: RequestStatus | undefined,
    user: IUser,
  ): Promise<{ data: RequestWithRelations[]; total: number }> {
    return this.repository.findByDriver(driverId, user.orgId, status);
  }

  /**
   * Find requests in DELIVERED status waiting for warehouse receipt
   */
  async findPendingReceipt(
    projectId: string | undefined,
    user: IUser,
  ): Promise<{ data: RequestWithRelations[]; total: number }> {
    return this.repository.findAll(user.orgId, {
      page: 1,
      limit: 50,
      status: RequestStatus.DELIVERED,
      projectId,
    });
  }

  /**
   * Get list of available drivers for assignment
   */
  async getAvailableDrivers(user: IUser): Promise<{ id: string; name: string }[]> {
    return this.repository.findDrivers(user.orgId);
  }
}
