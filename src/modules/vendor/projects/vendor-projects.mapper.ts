import { Injectable } from '@nestjs/common';

import { Project } from 'src/common/database/schemas';

import { ProjectResponseDto, PaginatedProjectResponseDto } from './dto';

@Injectable()
export class VendorProjectsMapper {
  mapProject(project: Project): ProjectResponseDto {
    return {
      id: project.id,
      name: project.name,
      description: project.description ?? undefined,
      budget: project.budget ?? undefined,
      status: project.status,
      address: project.address ?? undefined,
      floors: project.floors ?? undefined,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  mapPaginatedProjects(result: {
    data: Project[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedProjectResponseDto {
    return {
      total: result.total,
      page: result.page,
      limit: result.limit,
      data: result.data.map((p) => this.mapProject(p)),
    };
  }
}
