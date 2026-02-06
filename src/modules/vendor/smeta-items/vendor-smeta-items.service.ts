import { Injectable } from '@nestjs/common';

import { IUser } from 'src/common/consts/auth';
import { HandledException } from 'src/common/error/http.error';

import { CreateSmetaItemDto, QuerySmetaItemDto, UpdateSmetaItemDto } from './dto';
import { SmetaItemWithRelations, VendorSmetaItemsRepository } from './vendor-smeta-items.repository';

@Injectable()
export class VendorSmetaItemsService {
  constructor(private readonly repository: VendorSmetaItemsRepository) {}

  async create(dto: CreateSmetaItemDto, user: IUser): Promise<SmetaItemWithRelations> {
    const smetaOrgId = await this.repository.getSmetaOrgId(dto.smetaId);

    if (!smetaOrgId || smetaOrgId !== user.orgId) {
      HandledException.throw('SMETA_NOT_FOUND', 404);
    }

    const item = await this.repository.create({
      smetaId: dto.smetaId,
      itemType: dto.itemType,
      category: dto.category,
      code: dto.code,
      name: dto.name,
      unit: dto.unit,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      totalAmount: dto.quantity * dto.unitPrice,
      percentRate: dto.percentRate,
      machineType: dto.machineType,
      laborHours: dto.laborHours,
      source: dto.source,
      updatedBy: user.id,
    });

    return this.findOne(item.id, user);
  }

  async findAll(
    query: QuerySmetaItemDto,
    user: IUser,
  ): Promise<{ data: SmetaItemWithRelations[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 50, smetaId, projectId, itemType } = query;
    const result = await this.repository.findAll(user.orgId, {
      page,
      limit,
      smetaId,
      projectId,
      itemType,
    });
    return { ...result, page, limit };
  }

  async findOne(id: string, user: IUser): Promise<SmetaItemWithRelations> {
    const result = await this.repository.findById(id, user.orgId);

    if (!result) {
      HandledException.throw('SMETA_ITEM_NOT_FOUND', 404);
    }

    return result;
  }

  async update(id: string, dto: UpdateSmetaItemDto, user: IUser): Promise<SmetaItemWithRelations> {
    await this.findOne(id, user);

    await this.repository.update(id, {
      ...dto,
      updatedBy: user.id,
    });

    return this.findOne(id, user);
  }

  async remove(id: string, user: IUser): Promise<void> {
    await this.findOne(id, user);
    await this.repository.delete(id);
  }
}
