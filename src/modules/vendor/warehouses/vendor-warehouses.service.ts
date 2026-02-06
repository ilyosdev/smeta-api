import { Injectable } from '@nestjs/common';

import { IUser } from 'src/common/consts/auth';
import { WarehouseItem, WarehouseTransferStatus } from 'src/common/database/schemas';
import { HandledException } from 'src/common/error/http.error';

import {
  CreateWarehouseDto,
  CreateWarehouseItemDto,
  CreateWarehouseTransferDto,
  QueryWarehouseDto,
  UpdateWarehouseDto,
  UpdateWarehouseItemDto,
} from './dto';
import {
  VendorWarehousesRepository,
  WarehouseTransferWithRelations,
  WarehouseWithRelations,
} from './vendor-warehouses.repository';

@Injectable()
export class VendorWarehousesService {
  constructor(private readonly repository: VendorWarehousesRepository) {}

  async createWarehouse(dto: CreateWarehouseDto, user: IUser): Promise<WarehouseWithRelations> {
    const projectOrgId = await this.repository.getProjectOrgId(dto.projectId);
    if (!projectOrgId || projectOrgId !== user.orgId) {
      HandledException.throw('PROJECT_NOT_FOUND', 404);
    }

    const warehouse = await this.repository.createWarehouse({
      projectId: dto.projectId,
      name: dto.name,
      location: dto.location,
    });

    return this.findOneWarehouse(warehouse.id, user);
  }

  async findAllWarehouses(
    query: QueryWarehouseDto,
    user: IUser,
  ): Promise<{ data: WarehouseWithRelations[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, projectId } = query;
    const result = await this.repository.findAllWarehouses(user.orgId, { page, limit, projectId });
    return { ...result, page, limit };
  }

  async findOneWarehouse(id: string, user: IUser): Promise<WarehouseWithRelations> {
    const result = await this.repository.findWarehouseById(id, user.orgId);
    if (!result) {
      HandledException.throw('WAREHOUSE_NOT_FOUND', 404);
    }
    return result;
  }

  async updateWarehouse(id: string, dto: UpdateWarehouseDto, user: IUser): Promise<WarehouseWithRelations> {
    await this.findOneWarehouse(id, user);
    await this.repository.updateWarehouse(id, dto);
    return this.findOneWarehouse(id, user);
  }

  async removeWarehouse(id: string, user: IUser): Promise<void> {
    await this.findOneWarehouse(id, user);
    await this.repository.deleteWarehouse(id);
  }

  async createWarehouseItem(dto: CreateWarehouseItemDto, user: IUser): Promise<WarehouseItem> {
    const warehouseOrgId = await this.repository.getWarehouseOrgId(dto.warehouseId);
    if (!warehouseOrgId || warehouseOrgId !== user.orgId) {
      HandledException.throw('WAREHOUSE_NOT_FOUND', 404);
    }

    return this.repository.createWarehouseItem({
      warehouseId: dto.warehouseId,
      name: dto.name,
      unit: dto.unit,
      quantity: dto.quantity,
      smetaItemId: dto.smetaItemId,
    });
  }

  async findWarehouseItems(
    warehouseId: string,
    user: IUser,
    page = 1,
    limit = 50,
  ): Promise<{ data: WarehouseItem[]; total: number; page: number; limit: number }> {
    await this.findOneWarehouse(warehouseId, user);
    const result = await this.repository.findWarehouseItems(warehouseId, { page, limit });
    return { ...result, page, limit };
  }

  async updateWarehouseItem(id: string, dto: UpdateWarehouseItemDto, user: IUser): Promise<WarehouseItem> {
    const item = await this.repository.findWarehouseItemById(id);
    if (!item) {
      HandledException.throw('WAREHOUSE_ITEM_NOT_FOUND', 404);
    }

    const warehouseOrgId = await this.repository.getWarehouseOrgId(item.warehouseId);
    if (!warehouseOrgId || warehouseOrgId !== user.orgId) {
      HandledException.throw('WAREHOUSE_ITEM_NOT_FOUND', 404);
    }

    return this.repository.updateWarehouseItem(id, dto);
  }

  async removeWarehouseItem(id: string, user: IUser): Promise<void> {
    const item = await this.repository.findWarehouseItemById(id);
    if (!item) {
      HandledException.throw('WAREHOUSE_ITEM_NOT_FOUND', 404);
    }

    const warehouseOrgId = await this.repository.getWarehouseOrgId(item.warehouseId);
    if (!warehouseOrgId || warehouseOrgId !== user.orgId) {
      HandledException.throw('WAREHOUSE_ITEM_NOT_FOUND', 404);
    }

    await this.repository.deleteWarehouseItem(id);
  }

  async createTransfer(dto: CreateWarehouseTransferDto, user: IUser): Promise<WarehouseTransferWithRelations> {
    const fromOrgId = await this.repository.getWarehouseOrgId(dto.fromWarehouseId);
    if (!fromOrgId || fromOrgId !== user.orgId) {
      HandledException.throw('FROM_WAREHOUSE_NOT_FOUND', 404);
    }

    const toOrgId = await this.repository.getWarehouseOrgId(dto.toWarehouseId);
    if (!toOrgId || toOrgId !== user.orgId) {
      HandledException.throw('TO_WAREHOUSE_NOT_FOUND', 404);
    }

    if (dto.fromWarehouseId === dto.toWarehouseId) {
      HandledException.throw('CANNOT_TRANSFER_TO_SAME_WAREHOUSE', 400);
    }

    const transfer = await this.repository.createTransfer({
      fromWarehouseId: dto.fromWarehouseId,
      toWarehouseId: dto.toWarehouseId,
      itemName: dto.itemName,
      unit: dto.unit,
      quantity: dto.quantity,
      createdById: user.id,
    });

    return this.findOneTransfer(transfer.id, user);
  }

  async findAllTransfers(
    user: IUser,
    page = 1,
    limit = 20,
    warehouseId?: string,
  ): Promise<{ data: WarehouseTransferWithRelations[]; total: number; page: number; limit: number }> {
    const result = await this.repository.findTransfers(user.orgId, { page, limit, warehouseId });
    return { ...result, page, limit };
  }

  async findOneTransfer(id: string, user: IUser): Promise<WarehouseTransferWithRelations> {
    const result = await this.repository.findTransferById(id, user.orgId);
    if (!result) {
      HandledException.throw('TRANSFER_NOT_FOUND', 404);
    }
    return result;
  }

  async completeTransfer(id: string, user: IUser): Promise<WarehouseTransferWithRelations> {
    const transfer = await this.findOneTransfer(id, user);

    if (transfer.status !== WarehouseTransferStatus.PENDING) {
      HandledException.throw('CANNOT_COMPLETE_NON_PENDING_TRANSFER', 400);
    }

    await this.repository.updateTransfer(id, {
      status: WarehouseTransferStatus.COMPLETED,
      completedAt: new Date(),
    });

    return this.findOneTransfer(id, user);
  }

  async cancelTransfer(id: string, user: IUser): Promise<WarehouseTransferWithRelations> {
    const transfer = await this.findOneTransfer(id, user);

    if (transfer.status !== WarehouseTransferStatus.PENDING) {
      HandledException.throw('CANNOT_CANCEL_NON_PENDING_TRANSFER', 400);
    }

    await this.repository.updateTransfer(id, {
      status: WarehouseTransferStatus.CANCELLED,
    });

    return this.findOneTransfer(id, user);
  }
}
