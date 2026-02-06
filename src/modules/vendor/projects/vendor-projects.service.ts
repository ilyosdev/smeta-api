import { Injectable } from '@nestjs/common';

import { IUser } from 'src/common/consts/auth';
import { Project } from 'src/common/database/schemas';
import { HandledException } from 'src/common/error/http.error';

import { CreateProjectDto, QueryProjectDto, UpdateProjectDto } from './dto';
import { VendorProjectsRepository } from './vendor-projects.repository';

@Injectable()
export class VendorProjectsService {
  constructor(private readonly repository: VendorProjectsRepository) {}

  async create(dto: CreateProjectDto, user: IUser): Promise<Project> {
    return this.repository.create({
      orgId: user.orgId,
      ...dto,
    });
  }

  async findAll(query: QueryProjectDto, user: IUser): Promise<{ data: Project[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search, status } = query;
    const result = await this.repository.findAll(user.orgId, { page, limit, search, status });
    return { ...result, page, limit };
  }

  async findOne(id: string, user: IUser): Promise<Project> {
    const result = await this.repository.findById(id, user.orgId);

    if (!result) {
      HandledException.throw('PROJECT_NOT_FOUND', 404);
    }

    return result;
  }

  async update(id: string, dto: UpdateProjectDto, user: IUser): Promise<Project> {
    await this.findOne(id, user);
    return this.repository.update(id, user.orgId, dto);
  }

  async remove(id: string, user: IUser): Promise<void> {
    await this.findOne(id, user);
    await this.repository.delete(id, user.orgId);
  }
}
