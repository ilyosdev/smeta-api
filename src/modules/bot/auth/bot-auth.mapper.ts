import { Injectable } from '@nestjs/common';

import { User } from 'src/common/database/schemas';

import { BotAuthResponseDto, BotUserResponseDto } from './dto';

@Injectable()
export class BotAuthMapper {
  mapUser(user: User): BotUserResponseDto {
    return {
      id: user.id,
      name: user.name,
      telegramId: user.telegramId ?? undefined,
      role: user.role,
      orgId: user.orgId,
    };
  }

  mapAuthResponse(user: User, tokens: { accessToken: string; refreshToken: string }): BotAuthResponseDto {
    return {
      user: this.mapUser(user),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }
}
