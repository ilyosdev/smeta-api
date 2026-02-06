import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser, Roles } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import {
  CreateProjectDto,
  ProjectResponseDto,
  PaginatedProjectResponseDto,
  QueryProjectDto,
  UpdateProjectDto,
} from './dto';
import { VendorProjectsMapper } from './vendor-projects.mapper';
import { VendorProjectsService } from './vendor-projects.service';

@ApiTags('[VENDOR] Projects')
@Controller('vendor/projects')
export class VendorProjectsController {
  constructor(
    private readonly service: VendorProjectsService,
    private readonly mapper: VendorProjectsMapper,
  ) {}

  @Post()
  @Endpoint('Create project', true, [Roles.BOSS, Roles.DIREKTOR])
  @ApiOkResponse({ type: ProjectResponseDto })
  async create(@Body() dto: CreateProjectDto, @User() user: IUser): Promise<ProjectResponseDto> {
    const result = await this.service.create(dto, user);
    return this.mapper.mapProject(result);
  }

  @Get()
  @Endpoint('Get all projects', true)
  @ApiOkResponse({ type: PaginatedProjectResponseDto })
  async findAll(@Query() query: QueryProjectDto, @User() user: IUser): Promise<PaginatedProjectResponseDto> {
    const result = await this.service.findAll(query, user);
    return this.mapper.mapPaginatedProjects(result);
  }

  @Get(':id')
  @Endpoint('Get project by ID', true)
  @ApiOkResponse({ type: ProjectResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<ProjectResponseDto> {
    const result = await this.service.findOne(id, user);
    return this.mapper.mapProject(result);
  }

  @Patch(':id')
  @Endpoint('Update project', true, [Roles.BOSS, Roles.DIREKTOR])
  @ApiOkResponse({ type: ProjectResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @User() user: IUser,
  ): Promise<ProjectResponseDto> {
    const result = await this.service.update(id, dto, user);
    return this.mapper.mapProject(result);
  }

  @Delete(':id')
  @Endpoint('Delete project', true, [Roles.BOSS])
  async remove(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<{ success: boolean }> {
    await this.service.remove(id, user);
    return { success: true };
  }
}
