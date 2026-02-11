import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser, Roles } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import { AdminService } from './admin.service';
import {
  AssignProjectDto,
  CreateOperatorDto,
  CreateOrganizationDto,
  CreateOrgProjectDto,
  CreateOrgUserDto,
  QueryPaginatedDto,
  UpdateOperatorDto,
  UpdateOrganizationDto,
  UpdateOrgProjectDto,
  UpdateOrgUserDto,
} from './dto';

@ApiTags('[ADMIN]')
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  // ─── Stats ──────────────────────────────────────

  @Get('stats')
  @Endpoint('Get admin dashboard stats', true, [Roles.SUPER_ADMIN, Roles.OPERATOR])
  async getStats(@User() user: IUser) {
    return this.service.getStats(user);
  }

  // ─── Organizations ──────────────────────────────

  @Get('organizations')
  @Endpoint('List all organizations', true, [Roles.SUPER_ADMIN, Roles.OPERATOR])
  async listOrganizations(@Query() query: QueryPaginatedDto, @User() user: IUser) {
    return this.service.listOrganizations(query, user);
  }

  @Post('organizations')
  @Endpoint('Create organization', true, [Roles.SUPER_ADMIN, Roles.OPERATOR])
  async createOrganization(@Body() dto: CreateOrganizationDto, @User() user: IUser) {
    return this.service.createOrganization(dto, user);
  }

  @Get('organizations/:id')
  @Endpoint('Get organization details', true, [Roles.SUPER_ADMIN, Roles.OPERATOR])
  async getOrganization(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser) {
    return this.service.getOrganization(id, user);
  }

  @Patch('organizations/:id')
  @Endpoint('Update organization', true, [Roles.SUPER_ADMIN, Roles.OPERATOR])
  async updateOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
    @User() user: IUser,
  ) {
    return this.service.updateOrganization(id, dto, user);
  }

  @Delete('organizations/:id')
  @Endpoint('Delete organization', true, [Roles.SUPER_ADMIN])
  async deleteOrganization(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser) {
    await this.service.deleteOrganization(id, user);
    return { success: true };
  }

  // ─── Operators ──────────────────────────────────

  @Get('operators')
  @Endpoint('List all operators', true, [Roles.SUPER_ADMIN])
  async listOperators(@Query() query: QueryPaginatedDto, @User() user: IUser) {
    return this.service.listOperators(query, user);
  }

  @Post('operators')
  @Endpoint('Create operator', true, [Roles.SUPER_ADMIN])
  async createOperator(@Body() dto: CreateOperatorDto, @User() user: IUser) {
    return this.service.createOperator(dto, user);
  }

  @Patch('operators/:id')
  @Endpoint('Update operator', true, [Roles.SUPER_ADMIN])
  async updateOperator(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOperatorDto,
    @User() user: IUser,
  ) {
    return this.service.updateOperator(id, dto, user);
  }

  @Delete('operators/:id')
  @Endpoint('Delete operator', true, [Roles.SUPER_ADMIN])
  async deleteOperator(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser) {
    await this.service.deleteOperator(id, user);
    return { success: true };
  }

  // ─── Org Users ──────────────────────────────────

  @Get('organizations/:orgId/users')
  @Endpoint('List users in organization', true, [Roles.SUPER_ADMIN, Roles.OPERATOR])
  async listOrgUsers(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query() query: QueryPaginatedDto,
    @User() user: IUser,
  ) {
    return this.service.listOrgUsers(orgId, query, user);
  }

  @Post('organizations/:orgId/users')
  @Endpoint('Create user in organization', true, [Roles.SUPER_ADMIN, Roles.OPERATOR])
  async createOrgUser(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: CreateOrgUserDto,
    @User() user: IUser,
  ) {
    return this.service.createOrgUser(orgId, dto, user);
  }

  @Patch('organizations/:orgId/users/:id')
  @Endpoint('Update user in organization', true, [Roles.SUPER_ADMIN, Roles.OPERATOR])
  async updateOrgUser(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrgUserDto,
    @User() user: IUser,
  ) {
    return this.service.updateOrgUser(orgId, id, dto, user);
  }

  @Delete('organizations/:orgId/users/:id')
  @Endpoint('Delete user from organization', true, [Roles.SUPER_ADMIN, Roles.OPERATOR])
  async deleteOrgUser(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
  ) {
    await this.service.deleteOrgUser(orgId, id, user);
    return { success: true };
  }

  // ─── Org Projects ──────────────────────────────

  @Get('organizations/:orgId/projects')
  @Endpoint('List projects in organization', true, [Roles.SUPER_ADMIN, Roles.OPERATOR])
  async listOrgProjects(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query() query: QueryPaginatedDto,
    @User() user: IUser,
  ) {
    return this.service.listOrgProjects(orgId, query, user);
  }

  @Post('organizations/:orgId/projects')
  @Endpoint('Create project in organization', true, [Roles.SUPER_ADMIN, Roles.OPERATOR])
  async createOrgProject(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: CreateOrgProjectDto,
    @User() user: IUser,
  ) {
    return this.service.createOrgProject(orgId, dto, user);
  }

  @Patch('organizations/:orgId/projects/:id')
  @Endpoint('Update project in organization', true, [Roles.SUPER_ADMIN, Roles.OPERATOR])
  async updateOrgProject(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrgProjectDto,
    @User() user: IUser,
  ) {
    return this.service.updateOrgProject(orgId, id, dto, user);
  }

  @Delete('organizations/:orgId/projects/:id')
  @Endpoint('Delete project from organization', true, [Roles.SUPER_ADMIN, Roles.OPERATOR])
  async deleteOrgProject(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
  ) {
    await this.service.deleteOrgProject(orgId, id, user);
    return { success: true };
  }

  // ─── User-Project assignments ───────────────────

  @Get('organizations/:orgId/users/:userId/projects')
  @Endpoint('Get user project assignments', true, [Roles.SUPER_ADMIN, Roles.OPERATOR])
  async getUserProjects(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @User() user: IUser,
  ) {
    return this.service.getUserProjects(orgId, userId, user);
  }

  @Post('organizations/:orgId/users/:userId/projects')
  @Endpoint('Assign user to project', true, [Roles.SUPER_ADMIN, Roles.OPERATOR])
  async assignUserToProject(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignProjectDto,
    @User() user: IUser,
  ) {
    await this.service.assignUserToProject(orgId, userId, dto.projectId, user);
    return { success: true };
  }

  @Delete('organizations/:orgId/users/:userId/projects/:projectId')
  @Endpoint('Unassign user from project', true, [Roles.SUPER_ADMIN, Roles.OPERATOR])
  async unassignUserFromProject(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @User() user: IUser,
  ) {
    await this.service.unassignUserFromProject(orgId, userId, projectId, user);
    return { success: true };
  }
}
