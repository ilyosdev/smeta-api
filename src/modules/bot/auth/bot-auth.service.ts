import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { IUser } from 'src/common/consts/auth';
import { User } from 'src/common/database/schemas';
import { HandledException } from 'src/common/error/http.error';
import { env } from 'src/common/config';

import { TelegramAuthDto } from './dto';
import { BotAuthRepository } from './bot-auth.repository';

@Injectable()
export class BotAuthService {
  constructor(
    private readonly repository: BotAuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async authenticateByTelegram(dto: TelegramAuthDto): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string } }> {
    const user = await this.repository.findByTelegramId(dto.telegramId);

    if (!user) {
      HandledException.throw('USER_NOT_FOUND', 404);
    }

    if (!user.isActive) {
      HandledException.throw('USER_INACTIVE', 403);
    }

    const tokens = await this.generateTokens(user);

    return { user, tokens };
  }

  async getProfile(currentUser: IUser): Promise<User> {
    const user = await this.repository.findById(currentUser.id);

    if (!user) {
      HandledException.throw('USER_NOT_FOUND', 404);
    }

    return user;
  }

  async getUserByTelegramId(telegramId: string): Promise<User> {
    const user = await this.repository.findByTelegramId(telegramId);

    if (!user) {
      HandledException.throw('USER_NOT_FOUND', 404);
    }

    return user;
  }

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      id: user.id,
      orgId: user.orgId,
      role: user.role,
      telegramId: user.telegramId ?? undefined,
      name: user.name,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: env.ACCESS_TOKEN_SECRET,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: env.REFRESH_TOKEN_SECRET,
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
