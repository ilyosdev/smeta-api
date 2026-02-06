import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { sign, verify } from 'jsonwebtoken';

import { env } from 'src/common/config';
import { IUser, Roles } from 'src/common/consts/auth';
import { UserRole } from 'src/common/database/schemas';
import { HandledException } from 'src/common/error/http.error';

import { LoginDto, RefreshTokenDto, RegisterDto } from './dto';
import { VendorAuthRepository } from './vendor-auth.repository';

interface AuthResult {
  user: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    role: string;
    orgId: string;
    orgName: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

@Injectable()
export class VendorAuthService {
  constructor(private readonly repository: VendorAuthRepository) {}

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.repository.findUserByLogin(dto.login);

    if (!user) {
      HandledException.throw('USER_NOT_FOUND', 404);
    }

    if (!user.password) {
      HandledException.throw('PASSWORD_NOT_SET', 400);
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      HandledException.throw('INVALID_PASSWORD', 401);
    }

    if (!user.isActive) {
      HandledException.throw('USER_INACTIVE', 403);
    }

    const tokens = this.generateTokens({
      id: user.id,
      orgId: user.orgId,
      role: user.role as Roles,
      name: user.name,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone ?? undefined,
        email: user.email ?? undefined,
        role: user.role,
        orgId: user.orgId,
        orgName: user.organization.name,
      },
      tokens,
    };
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    if (dto.email) {
      const existingEmail = await this.repository.findUserByEmail(dto.email);
      if (existingEmail) {
        HandledException.throw('EMAIL_ALREADY_EXISTS', 409);
      }
    }

    if (dto.phone) {
      const existingPhone = await this.repository.findUserByPhone(dto.phone);
      if (existingPhone) {
        HandledException.throw('PHONE_ALREADY_EXISTS', 409);
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const organization = await this.repository.createOrganization({
      name: dto.orgName,
    });

    const user = await this.repository.createUser({
      orgId: organization.id,
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      password: hashedPassword,
      role: UserRole.BOSS,
    });

    const tokens = this.generateTokens({
      id: user.id,
      orgId: user.orgId,
      role: user.role as Roles,
      name: user.name,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone ?? undefined,
        email: user.email ?? undefined,
        role: user.role,
        orgId: user.orgId,
        orgName: organization.name,
      },
      tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = verify(dto.refreshToken, env.REFRESH_TOKEN_SECRET) as IUser;

      const user = await this.repository.findUserById(payload.id);
      if (!user || !user.isActive) {
        HandledException.throw('USER_NOT_FOUND_OR_INACTIVE', 401);
      }

      return this.generateTokens({
        id: user.id,
        orgId: user.orgId,
        role: user.role as Roles,
        name: user.name,
      });
    } catch {
      HandledException.throw('INVALID_REFRESH_TOKEN', 401);
    }
  }

  async getProfile(userId: string): Promise<AuthResult['user']> {
    const user = await this.repository.findUserById(userId);

    if (!user) {
      HandledException.throw('USER_NOT_FOUND', 404);
    }

    return {
      id: user.id,
      name: user.name,
      phone: user.phone ?? undefined,
      email: user.email ?? undefined,
      role: user.role,
      orgId: user.orgId,
      orgName: user.organization.name,
    };
  }

  private generateTokens(payload: IUser): { accessToken: string; refreshToken: string } {
    const accessToken = sign(payload as object, env.ACCESS_TOKEN_SECRET, {
      expiresIn: '15m',
    });

    const refreshToken = sign(payload as object, env.REFRESH_TOKEN_SECRET, {
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }
}
