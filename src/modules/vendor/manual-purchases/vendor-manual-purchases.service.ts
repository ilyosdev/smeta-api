import { Injectable } from '@nestjs/common';

import { IUser } from 'src/common/consts/auth';
import { HandledException } from 'src/common/error/http.error';

import { CreateManualPurchaseDto, QueryManualPurchaseDto, UpdateManualPurchaseDto } from './dto';
import { ManualPurchaseWithRelations, VendorManualPurchasesRepository } from './vendor-manual-purchases.repository';

@Injectable()
export class VendorManualPurchasesService {
  constructor(private readonly repository: VendorManualPurchasesRepository) {}

  async createManualPurchase(dto: CreateManualPurchaseDto, user: IUser): Promise<ManualPurchaseWithRelations> {
    const smetaItemOrgId = await this.repository.getSmetaItemOrgId(dto.smetaItemId);
    if (!smetaItemOrgId || smetaItemOrgId !== user.orgId) {
      HandledException.throw('SMETA_ITEM_NOT_FOUND', 404);
    }

    const manualPurchase = await this.repository.createManualPurchase({
      smetaItemId: dto.smetaItemId,
      quantity: dto.quantity,
      amount: dto.amount,
      receiptUrl: dto.receiptUrl,
      note: dto.note,
      submittedById: user.id,
      source: dto.source,
    });

    return this.findOneManualPurchase(manualPurchase.id, user);
  }

  async findAllManualPurchases(
    query: QueryManualPurchaseDto,
    user: IUser,
  ): Promise<{ data: ManualPurchaseWithRelations[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, smetaItemId } = query;
    const result = await this.repository.findAllManualPurchases(user.orgId, { page, limit, smetaItemId });
    return { ...result, page, limit };
  }

  async findOneManualPurchase(id: string, user: IUser): Promise<ManualPurchaseWithRelations> {
    const result = await this.repository.findManualPurchaseById(id, user.orgId);
    if (!result) {
      HandledException.throw('MANUAL_PURCHASE_NOT_FOUND', 404);
    }
    return result;
  }

  async updateManualPurchase(id: string, dto: UpdateManualPurchaseDto, user: IUser): Promise<ManualPurchaseWithRelations> {
    await this.findOneManualPurchase(id, user);
    await this.repository.updateManualPurchase(id, dto);
    return this.findOneManualPurchase(id, user);
  }

  async removeManualPurchase(id: string, user: IUser): Promise<void> {
    await this.findOneManualPurchase(id, user);
    await this.repository.deleteManualPurchase(id);
  }
}
