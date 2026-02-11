import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { IUser } from 'src/common/consts/auth';
import { User, UserRole } from 'src/common/database/schemas';
import { HandledException } from 'src/common/error/http.error';

import { CreateUserDto, QueryUserDto, UpdateUserDto } from './dto';
import { VendorUsersRepository } from './vendor-users.repository';

@Injectable()
export class VendorUsersService {
  constructor(private readonly repository: VendorUsersRepository) {}

  async create(dto: CreateUserDto, user: IUser): Promise<User> {
    if (dto.email) {
      const existingUser = await this.repository.findByEmail(dto.email);
      if (existingUser) {
        HandledException.throw('EMAIL_ALREADY_EXISTS', 409);
      }
    }

    if (dto.telegramId) {
      const existingUser = await this.repository.findByTelegramId(dto.telegramId);
      if (existingUser) {
        HandledException.throw('TELEGRAM_ID_ALREADY_EXISTS', 409);
      }
    }

    let hashedPassword: string | undefined;
    if (dto.password) {
      hashedPassword = await bcrypt.hash(dto.password, 10);
    }

    return this.repository.create({
      orgId: user.orgId,
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      password: hashedPassword,
      telegramId: dto.telegramId,
      role: dto.role,
    });
  }

  async findAll(query: QueryUserDto, user: IUser): Promise<{ data: User[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search, role, isActive } = query;
    const result = await this.repository.findAll(user.orgId, { page, limit, search, role, isActive });
    return { ...result, page, limit };
  }

  async findOne(id: string, user: IUser): Promise<User> {
    const result = await this.repository.findById(id, user.orgId);

    if (!result) {
      HandledException.throw('USER_NOT_FOUND', 404);
    }

    return result;
  }

  async update(id: string, dto: UpdateUserDto, user: IUser): Promise<User> {
    await this.findOne(id, user);

    if (dto.email) {
      const existingUser = await this.repository.findByEmail(dto.email);
      if (existingUser && existingUser.id !== id) {
        HandledException.throw('EMAIL_ALREADY_EXISTS', 409);
      }
    }

    if (dto.telegramId) {
      const existingUser = await this.repository.findByTelegramId(dto.telegramId);
      if (existingUser && existingUser.id !== id) {
        HandledException.throw('TELEGRAM_ID_ALREADY_EXISTS', 409);
      }
    }

    let hashedPassword: string | undefined;
    if (dto.password) {
      hashedPassword = await bcrypt.hash(dto.password, 10);
    }

    return this.repository.update(id, user.orgId, {
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      password: hashedPassword,
      telegramId: dto.telegramId,
      role: dto.role,
      isActive: dto.isActive,
    });
  }

  async remove(id: string, user: IUser): Promise<void> {
    const targetUser = await this.findOne(id, user);

    if (targetUser.id === user.id) {
      HandledException.throw('CANNOT_DELETE_SELF', 400);
    }

    await this.repository.delete(id, user.orgId);
  }

  async findByProjectAndRole(projectId: string, role: UserRole, user: IUser): Promise<User[]> {
    return this.repository.findByProjectAndRole(projectId, role, user.orgId);
  }
}
