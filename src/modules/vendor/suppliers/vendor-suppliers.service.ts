import { Injectable } from '@nestjs/common';

import { IUser } from 'src/common/consts/auth';
import { SupplyOrderStatus } from 'src/common/database/schemas';
import { HandledException } from 'src/common/error/http.error';

import {
  CreateSupplierDebtDto,
  CreateSupplierDto,
  CreateSupplyOrderDto,
  QuerySupplierDto,
  QuerySupplyOrderDto,
  UpdateSupplierDto,
  UpdateSupplyOrderDto,
} from './dto';
import {
  SupplierDebtWithRelations,
  SupplierWithDebt,
  SupplyOrderWithRelations,
  VendorSuppliersRepository,
} from './vendor-suppliers.repository';

@Injectable()
export class VendorSuppliersService {
  constructor(private readonly repository: VendorSuppliersRepository) {}

  async createSupplier(dto: CreateSupplierDto, user: IUser): Promise<SupplierWithDebt> {
    const supplier = await this.repository.createSupplier({
      orgId: user.orgId,
      name: dto.name,
      phone: dto.phone,
      address: dto.address,
    });

    return { ...supplier, totalDebt: 0 };
  }

  async findAllSuppliers(
    query: QuerySupplierDto,
    user: IUser,
  ): Promise<{ data: SupplierWithDebt[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, search } = query;
    const result = await this.repository.findAllSuppliers(user.orgId, { page, limit, search });
    return { ...result, page, limit };
  }

  async findOneSupplier(id: string, user: IUser): Promise<SupplierWithDebt> {
    const result = await this.repository.findSupplierById(id, user.orgId);
    if (!result) {
      HandledException.throw('SUPPLIER_NOT_FOUND', 404);
    }
    return result;
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto, user: IUser): Promise<SupplierWithDebt> {
    await this.findOneSupplier(id, user);
    await this.repository.updateSupplier(id, dto);
    return this.findOneSupplier(id, user);
  }

  async removeSupplier(id: string, user: IUser): Promise<void> {
    await this.findOneSupplier(id, user);
    await this.repository.deleteSupplier(id);
  }

  async createSupplyOrder(dto: CreateSupplyOrderDto, user: IUser): Promise<SupplyOrderWithRelations> {
    const supplierOrgId = await this.repository.getSupplierOrgId(dto.supplierId);
    if (!supplierOrgId || supplierOrgId !== user.orgId) {
      HandledException.throw('SUPPLIER_NOT_FOUND', 404);
    }

    const projectOrgId = await this.repository.getProjectOrgId(dto.projectId);
    if (!projectOrgId || projectOrgId !== user.orgId) {
      HandledException.throw('PROJECT_NOT_FOUND', 404);
    }

    const items = dto.items.map((item) => ({
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalCost: item.quantity * item.unitPrice,
      smetaItemId: item.smetaItemId,
      orderId: '',
    }));

    const order = await this.repository.createSupplyOrder(
      {
        supplierId: dto.supplierId,
        projectId: dto.projectId,
        note: dto.note,
        orderedById: user.id,
      },
      items,
    );

    return this.findOneSupplyOrder(order.id, user);
  }

  async findAllSupplyOrders(
    query: QuerySupplyOrderDto,
    user: IUser,
  ): Promise<{ data: SupplyOrderWithRelations[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, supplierId, projectId, status } = query;
    const result = await this.repository.findAllSupplyOrders(user.orgId, { page, limit, supplierId, projectId, status });
    return { ...result, page, limit };
  }

  async findOneSupplyOrder(id: string, user: IUser): Promise<SupplyOrderWithRelations> {
    const result = await this.repository.findSupplyOrderById(id, user.orgId);
    if (!result) {
      HandledException.throw('SUPPLY_ORDER_NOT_FOUND', 404);
    }
    return result;
  }

  async updateSupplyOrder(id: string, dto: UpdateSupplyOrderDto, user: IUser): Promise<SupplyOrderWithRelations> {
    const order = await this.findOneSupplyOrder(id, user);

    const updateData: Record<string, unknown> = {};
    if (dto.status) {
      updateData.status = dto.status;
      if (dto.status === SupplyOrderStatus.DELIVERED) {
        updateData.deliveredAt = new Date();
      }
    }
    if (dto.note !== undefined) {
      updateData.note = dto.note;
    }

    await this.repository.updateSupplyOrder(id, updateData);
    return this.findOneSupplyOrder(id, user);
  }

  async removeSupplyOrder(id: string, user: IUser): Promise<void> {
    const order = await this.findOneSupplyOrder(id, user);
    if (order.status !== SupplyOrderStatus.ORDERED) {
      HandledException.throw('CANNOT_DELETE_PROCESSED_ORDER', 400);
    }
    await this.repository.deleteSupplyOrder(id);
  }

  async createSupplierDebt(dto: CreateSupplierDebtDto, user: IUser): Promise<SupplierDebtWithRelations> {
    const supplierOrgId = await this.repository.getSupplierOrgId(dto.supplierId);
    if (!supplierOrgId || supplierOrgId !== user.orgId) {
      HandledException.throw('SUPPLIER_NOT_FOUND', 404);
    }

    const debt = await this.repository.createSupplierDebt({
      supplierId: dto.supplierId,
      amount: dto.amount,
      reason: dto.reason,
      orderId: dto.orderId,
    });

    return { ...debt, supplier: undefined };
  }

  async findSupplierDebts(
    supplierId: string,
    user: IUser,
    page = 1,
    limit = 20,
  ): Promise<{ data: SupplierDebtWithRelations[]; total: number; page: number; limit: number }> {
    await this.findOneSupplier(supplierId, user);
    const result = await this.repository.findSupplierDebts(supplierId, user.orgId, { page, limit });
    return { ...result, page, limit };
  }

  async findSupplierDebtsByFilter(
    user: IUser,
    params: { supplierId?: string; isPaid?: boolean; dateFrom?: Date; dateTo?: Date; page?: number; limit?: number },
  ): Promise<{ data: SupplierDebtWithRelations[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, ...rest } = params;
    const result = await this.repository.findSupplierDebtsByFilter(user.orgId, { ...rest, page, limit });
    return { ...result, page, limit };
  }

  async findPaidDebts(
    user: IUser,
    params: { projectId?: string; dateFrom?: Date; dateTo?: Date; page?: number; limit?: number },
  ): Promise<{ data: SupplierDebtWithRelations[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, ...rest } = params;
    const result = await this.repository.findPaidDebts(user.orgId, { ...rest, page, limit });
    return { ...result, page, limit };
  }

  async findSupplierByUserId(userId: string, user: IUser): Promise<SupplierWithDebt | null> {
    return this.repository.findSupplierByUserId(userId, user.orgId);
  }

  async paySupplierDebt(debtId: string, user: IUser): Promise<{ success: boolean }> {
    await this.repository.paySupplierDebt(debtId, user.id);
    return { success: true };
  }
}
