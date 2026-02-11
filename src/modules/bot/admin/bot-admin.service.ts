import { Injectable } from '@nestjs/common';

import { Organization, Project, User, UserRole } from 'src/common/database/schemas';

import { BotAdminRepository } from './bot-admin.repository';

@Injectable()
export class BotAdminService {
  constructor(private readonly repository: BotAdminRepository) {}

  async listOperators(
    page = 1,
    limit = 20,
  ): Promise<{ data: (User & { orgName: string })[]; total: number }> {
    return this.repository.findAllOperators(page, limit);
  }

  async listOrganizations(
    page = 1,
    limit = 20,
  ): Promise<{ data: (Organization & { userCount: number; projectCount: number })[]; total: number }> {
    return this.repository.findAllOrganizations(page, limit);
  }

  async createOrganization(name: string, phone?: string): Promise<Organization> {
    return this.repository.createOrganization(name, phone);
  }

  async createOperator(name: string, phone: string, orgId: string): Promise<User> {
    return this.repository.createUser({
      orgId,
      name,
      phone,
      role: UserRole.OPERATOR,
    });
  }

  async createUser(
    name: string,
    phone: string,
    role: UserRole,
    orgId: string,
  ): Promise<User> {
    return this.repository.createUser({
      orgId,
      name,
      phone,
      role,
    });
  }

  async createProjectForOrg(
    orgId: string,
    data: { name: string; address?: string; floors?: number; budget?: number },
  ): Promise<Project> {
    return this.repository.createProject(orgId, data);
  }

  async assignUserToProject(userId: string, projectId: string): Promise<void> {
    return this.repository.assignUserToProject(userId, projectId);
  }

  async getUserProjects(
    userId: string,
  ): Promise<{ projectId: string; projectName: string }[]> {
    return this.repository.getUserProjectAssignments(userId);
  }

  async findOrganizationById(orgId: string): Promise<Organization | null> {
    return this.repository.findOrganizationById(orgId);
  }

  async listUsers(
    orgId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: User[]; total: number }> {
    return this.repository.findAllUsers(orgId, page, limit);
  }

  async listProjects(
    orgId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: import('src/common/database/schemas').Project[]; total: number }> {
    return this.repository.findAllProjects(orgId, page, limit);
  }
}
