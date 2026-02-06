import { Injectable } from '@nestjs/common';

import { IUser } from 'src/common/consts/auth';
import { Smeta } from 'src/common/database/schemas';
import { HandledException } from 'src/common/error/http.error';

import { CreateSmetaDto, QuerySmetaDto, UpdateSmetaDto } from './dto';
import { SmetaWithProject, VendorSmetasRepository } from './vendor-smetas.repository';

@Injectable()
export class VendorSmetasService {
  constructor(private readonly repository: VendorSmetasRepository) {}

  async create(dto: CreateSmetaDto, user: IUser): Promise<SmetaWithProject> {
    const smeta = await this.repository.create({
      projectId: dto.projectId,
      name: dto.name,
      type: dto.type,
      overheadPercent: dto.overheadPercent,
    });

    const result = await this.repository.findById(smeta.id, user.orgId);
    if (!result) {
      HandledException.throw('SMETA_NOT_FOUND', 404);
    }
    return result;
  }

  async findAll(
    query: QuerySmetaDto,
    user: IUser,
  ): Promise<{ data: SmetaWithProject[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, projectId, search, type } = query;
    const result = await this.repository.findAll(user.orgId, { page, limit, projectId, search, type });
    return { ...result, page, limit };
  }

  async findOne(id: string, user: IUser): Promise<SmetaWithProject> {
    const result = await this.repository.findById(id, user.orgId);

    if (!result) {
      HandledException.throw('SMETA_NOT_FOUND', 404);
    }

    return result;
  }

  async update(id: string, dto: UpdateSmetaDto, user: IUser): Promise<SmetaWithProject> {
    await this.findOne(id, user);
    await this.repository.update(id, dto);
    return this.findOne(id, user);
  }

  async remove(id: string, user: IUser): Promise<void> {
    await this.findOne(id, user);
    await this.repository.delete(id);
  }
}
