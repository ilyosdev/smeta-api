import { Injectable } from '@nestjs/common';

import {
  PaginatedSupplierDebtResponseDto,
  PaginatedSupplierResponseDto,
  PaginatedSupplyOrderResponseDto,
  SupplierDebtResponseDto,
  SupplierResponseDto,
  SupplyOrderResponseDto,
} from './dto';
import {
  SupplierDebtWithRelations,
  SupplierWithDebt,
  SupplyOrderWithRelations,
} from './vendor-suppliers.repository';

@Injectable()
export class VendorSuppliersMapper {
  mapSupplier(supplier: SupplierWithDebt): SupplierResponseDto {
    return {
      id: supplier.id,
      orgId: supplier.orgId,
      name: supplier.name,
      phone: supplier.phone,
      address: supplier.address,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
      totalDebt: supplier.totalDebt,
    };
  }

  mapPaginatedSuppliers(result: {
    data: SupplierWithDebt[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedSupplierResponseDto {
    return {
      data: result.data.map((s) => this.mapSupplier(s)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  mapSupplyOrder(order: SupplyOrderWithRelations): SupplyOrderResponseDto {
    return {
      id: order.id,
      supplierId: order.supplierId,
      projectId: order.projectId,
      status: order.status,
      totalCost: order.totalCost,
      note: order.note,
      orderedById: order.orderedById,
      createdAt: order.createdAt,
      deliveredAt: order.deliveredAt,
      supplier: order.supplier,
      project: order.project,
      orderedBy: order.orderedBy,
      items: order.items?.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalCost: item.totalCost,
        smetaItemId: item.smetaItemId,
      })),
    };
  }

  mapPaginatedSupplyOrders(result: {
    data: SupplyOrderWithRelations[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedSupplyOrderResponseDto {
    return {
      data: result.data.map((o) => this.mapSupplyOrder(o)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  mapSupplierDebt(debt: SupplierDebtWithRelations): SupplierDebtResponseDto {
    return {
      id: debt.id,
      supplierId: debt.supplierId,
      amount: debt.amount,
      reason: debt.reason,
      orderId: debt.orderId,
      isPaid: debt.isPaid,
      paidAt: debt.paidAt,
      paidById: debt.paidById,
      createdAt: debt.createdAt,
      supplier: debt.supplier,
    };
  }

  mapPaginatedSupplierDebts(result: {
    data: SupplierDebtWithRelations[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedSupplierDebtResponseDto {
    return {
      data: result.data.map((d) => this.mapSupplierDebt(d)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
