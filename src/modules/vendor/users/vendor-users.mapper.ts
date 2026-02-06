import { Injectable } from '@nestjs/common';

import { User } from 'src/common/database/schemas';

import { PaginatedUserResponseDto, UserResponseDto } from './dto';

@Injectable()
export class VendorUsersMapper {
  mapUser(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone ?? undefined,
      email: user.email ?? undefined,
      telegramId: user.telegramId ?? undefined,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  mapPaginatedUsers(result: {
    data: User[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedUserResponseDto {
    return {
      total: result.total,
      page: result.page,
      limit: result.limit,
      data: result.data.map((u) => this.mapUser(u)),
    };
  }
}
