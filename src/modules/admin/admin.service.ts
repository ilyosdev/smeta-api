import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { IUser } from 'src/common/consts/auth';
import { Organization, Project, User, UserRole } from 'src/common/database/schemas';
import { HandledException } from 'src/common/error/http.error';

import { AdminRepository } from './admin.repository';
import {
  CreateOperatorDto,
  CreateOrganizationDto,
  CreateOrgProjectDto,
  CreateOrgUserDto,
  UpdateOperatorDto,
  UpdateOrganizationDto,
  UpdateOrgProjectDto,
  UpdateOrgUserDto,
} from './dto';

@Injectable()
export class AdminService {
  constructor(private readonly repository: AdminRepository) {}

  // ─── Access helpers ─────────────────────────────

  private isSuperAdmin(user: IUser): boolean {
    return user.role === UserRole.SUPER_ADMIN;
  }

  private async ensureOrgAccess(user: IUser, orgId: string): Promise<void> {
    if (this.isSuperAdmin(user)) return;
    const assigned = await this.repository.isOperatorAssignedToOrg(user.id, orgId);
    if (!assigned) {
      HandledException.throw('FORBIDDEN', 403);
    }
  }

  // ─── Stats ──────────────────────────────────────

  async getStats(user: IUser) {
    const operatorId = this.isSuperAdmin(user) ? undefined : user.id;
    return this.repository.getStats(operatorId);
  }

  // ─── Organizations ──────────────────────────────

  async listOrganizations(params: { page?: number; limit?: number; search?: string }, user: IUser) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const operatorId = this.isSuperAdmin(user) ? undefined : user.id;
    return this.repository.findAllOrganizations({ page, limit, search: params.search }, operatorId);
  }

  async getOrganization(orgId: string, user: IUser) {
    await this.ensureOrgAccess(user, orgId);
    const org = await this.repository.findOrganizationById(orgId);
    if (!org) {
      HandledException.throw('ORGANIZATION_NOT_FOUND', 404);
    }
    return org;
  }

  async createOrganization(dto: CreateOrganizationDto, user: IUser): Promise<Organization> {
    const org = await this.repository.createOrganization(dto.name, dto.phone);
    // Auto-assign operator to org if user is OPERATOR
    if (!this.isSuperAdmin(user)) {
      await this.repository.assignOperatorToOrg(user.id, org.id);
    }
    return org;
  }

  async updateOrganization(orgId: string, dto: UpdateOrganizationDto, user: IUser): Promise<Organization> {
    await this.ensureOrgAccess(user, orgId);
    const org = await this.repository.findOrganizationById(orgId);
    if (!org) {
      HandledException.throw('ORGANIZATION_NOT_FOUND', 404);
    }
    return this.repository.updateOrganization(orgId, {
      name: dto.name,
      phone: dto.phone !== undefined ? (dto.phone || null) : undefined,
      isActive: dto.isActive,
    });
  }

  async deleteOrganization(orgId: string, user: IUser): Promise<void> {
    if (!this.isSuperAdmin(user)) {
      HandledException.throw('FORBIDDEN', 403);
    }
    const org = await this.repository.findOrganizationById(orgId);
    if (!org) {
      HandledException.throw('ORGANIZATION_NOT_FOUND', 404);
    }
    await this.repository.deleteOrganization(orgId);
  }

  // ─── Operators ──────────────────────────────────

  async listOperators(params: { page?: number; limit?: number; search?: string }, user: IUser) {
    if (!this.isSuperAdmin(user)) {
      HandledException.throw('FORBIDDEN', 403);
    }
    const page = params.page || 1;
    const limit = params.limit || 20;
    return this.repository.findAllOperators({ page, limit, search: params.search });
  }

  async createOperator(dto: CreateOperatorDto, user: IUser): Promise<User> {
    if (!this.isSuperAdmin(user)) {
      HandledException.throw('FORBIDDEN', 403);
    }

    // Check unique phone
    const existing = await this.repository.findUserByPhone(dto.phone);
    if (existing) {
      HandledException.throw('PHONE_ALREADY_EXISTS', 409);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    // Operators belong to the System org (same as the SUPER_ADMIN's org)
    const operator = await this.repository.createUser({
      orgId: user.orgId,
      name: dto.name,
      phone: dto.phone,
      password: hashedPassword,
      role: UserRole.OPERATOR,
    });

    // Assign to specified orgs
    if (dto.orgIds?.length) {
      for (const orgId of dto.orgIds) {
        await this.repository.assignOperatorToOrg(operator.id, orgId);
      }
    }

    return operator;
  }

  async updateOperator(id: string, dto: UpdateOperatorDto, user: IUser): Promise<User> {
    if (!this.isSuperAdmin(user)) {
      HandledException.throw('FORBIDDEN', 403);
    }

    const operator = await this.repository.findOperatorById(id);
    if (!operator) {
      HandledException.throw('OPERATOR_NOT_FOUND', 404);
    }

    if (dto.phone) {
      const existing = await this.repository.findUserByPhone(dto.phone);
      if (existing && existing.id !== id) {
        HandledException.throw('PHONE_ALREADY_EXISTS', 409);
      }
    }

    let hashedPassword: string | undefined;
    if (dto.password) {
      hashedPassword = await bcrypt.hash(dto.password, 10);
    }

    return this.repository.updateUser(id, {
      name: dto.name,
      phone: dto.phone,
      password: hashedPassword,
      isActive: dto.isActive,
    });
  }

  async deleteOperator(id: string, user: IUser): Promise<void> {
    if (!this.isSuperAdmin(user)) {
      HandledException.throw('FORBIDDEN', 403);
    }

    const operator = await this.repository.findOperatorById(id);
    if (!operator) {
      HandledException.throw('OPERATOR_NOT_FOUND', 404);
    }

    await this.repository.deleteUser(id);
  }

  // ─── Org Users ──────────────────────────────────

  async listOrgUsers(orgId: string, params: { page?: number; limit?: number; search?: string }, user: IUser) {
    await this.ensureOrgAccess(user, orgId);
    const page = params.page || 1;
    const limit = params.limit || 20;
    return this.repository.findAllUsers(orgId, { page, limit, search: params.search });
  }

  async createOrgUser(orgId: string, dto: CreateOrgUserDto, user: IUser): Promise<User> {
    await this.ensureOrgAccess(user, orgId);

    // Validate phone uniqueness
    const existing = await this.repository.findUserByPhone(dto.phone);
    if (existing) {
      HandledException.throw('PHONE_ALREADY_EXISTS', 409);
    }

    if (dto.telegramId) {
      const existingTg = await this.repository.findUserByTelegramId(dto.telegramId);
      if (existingTg) {
        HandledException.throw('TELEGRAM_ID_ALREADY_EXISTS', 409);
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.repository.createUser({
      orgId,
      name: dto.name,
      phone: dto.phone,
      password: hashedPassword,
      role: dto.role,
      telegramId: dto.telegramId,
    });
  }

  async updateOrgUser(orgId: string, userId: string, dto: UpdateOrgUserDto, user: IUser): Promise<User> {
    await this.ensureOrgAccess(user, orgId);

    const targetUser = await this.repository.findUserById(userId, orgId);
    if (!targetUser) {
      HandledException.throw('USER_NOT_FOUND', 404);
    }

    if (dto.phone) {
      const existing = await this.repository.findUserByPhone(dto.phone);
      if (existing && existing.id !== userId) {
        HandledException.throw('PHONE_ALREADY_EXISTS', 409);
      }
    }

    if (dto.telegramId) {
      const existing = await this.repository.findUserByTelegramId(dto.telegramId);
      if (existing && existing.id !== userId) {
        HandledException.throw('TELEGRAM_ID_ALREADY_EXISTS', 409);
      }
    }

    let hashedPassword: string | undefined;
    if (dto.password) {
      hashedPassword = await bcrypt.hash(dto.password, 10);
    }

    return this.repository.updateUser(userId, {
      name: dto.name,
      phone: dto.phone,
      password: hashedPassword,
      role: dto.role,
      isActive: dto.isActive,
      telegramId: dto.telegramId,
    }, orgId);
  }

  async deleteOrgUser(orgId: string, userId: string, user: IUser): Promise<void> {
    await this.ensureOrgAccess(user, orgId);

    const targetUser = await this.repository.findUserById(userId, orgId);
    if (!targetUser) {
      HandledException.throw('USER_NOT_FOUND', 404);
    }

    await this.repository.deleteUser(userId, orgId);
  }

  // ─── Org Projects ──────────────────────────────

  async listOrgProjects(orgId: string, params: { page?: number; limit?: number; search?: string }, user: IUser) {
    await this.ensureOrgAccess(user, orgId);
    const page = params.page || 1;
    const limit = params.limit || 20;
    return this.repository.findAllProjects(orgId, { page, limit, search: params.search });
  }

  async createOrgProject(orgId: string, dto: CreateOrgProjectDto, user: IUser): Promise<Project> {
    await this.ensureOrgAccess(user, orgId);
    return this.repository.createProject(orgId, {
      name: dto.name,
      address: dto.address,
      floors: dto.floors,
      budget: dto.budget,
    });
  }

  async updateOrgProject(orgId: string, projectId: string, dto: UpdateOrgProjectDto, user: IUser): Promise<Project> {
    await this.ensureOrgAccess(user, orgId);

    const project = await this.repository.findProjectById(projectId, orgId);
    if (!project) {
      HandledException.throw('PROJECT_NOT_FOUND', 404);
    }

    return this.repository.updateProject(projectId, orgId, {
      name: dto.name,
      address: dto.address !== undefined ? (dto.address || null) : undefined,
      floors: dto.floors !== undefined ? (dto.floors || null) : undefined,
      budget: dto.budget !== undefined ? (dto.budget || null) : undefined,
      status: dto.status,
    });
  }

  async deleteOrgProject(orgId: string, projectId: string, user: IUser): Promise<void> {
    await this.ensureOrgAccess(user, orgId);

    const project = await this.repository.findProjectById(projectId, orgId);
    if (!project) {
      HandledException.throw('PROJECT_NOT_FOUND', 404);
    }

    await this.repository.deleteProject(projectId, orgId);
  }

  // ─── User-Project assignments ───────────────────

  async getUserProjects(orgId: string, userId: string, user: IUser) {
    await this.ensureOrgAccess(user, orgId);

    const targetUser = await this.repository.findUserById(userId, orgId);
    if (!targetUser) {
      HandledException.throw('USER_NOT_FOUND', 404);
    }

    return this.repository.getUserProjectAssignments(userId);
  }

  async assignUserToProject(orgId: string, userId: string, projectId: string, user: IUser): Promise<void> {
    await this.ensureOrgAccess(user, orgId);

    const targetUser = await this.repository.findUserById(userId, orgId);
    if (!targetUser) {
      HandledException.throw('USER_NOT_FOUND', 404);
    }

    const project = await this.repository.findProjectById(projectId, orgId);
    if (!project) {
      HandledException.throw('PROJECT_NOT_FOUND', 404);
    }

    await this.repository.assignUserToProject(userId, projectId);
  }

  async unassignUserFromProject(orgId: string, userId: string, projectId: string, user: IUser): Promise<void> {
    await this.ensureOrgAccess(user, orgId);
    await this.repository.unassignUserFromProject(userId, projectId);
  }
}
