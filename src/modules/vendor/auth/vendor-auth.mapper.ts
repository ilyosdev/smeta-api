import { Injectable } from '@nestjs/common';

import { AuthResponseDto, TokensResponseDto, UserResponseDto } from './dto';

@Injectable()
export class VendorAuthMapper {
  mapUser(user: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    role: string;
    orgId: string;
    orgName: string;
  }): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
      orgName: user.orgName,
    };
  }

  mapTokens(tokens: { accessToken: string; refreshToken: string }): TokensResponseDto {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  mapAuthResponse(data: {
    user: {
      id: string;
      name: string;
      phone?: string;
      email?: string;
      role: string;
      orgId: string;
      orgName: string;
    };
    tokens: { accessToken: string; refreshToken: string };
  }): AuthResponseDto {
    return {
      user: this.mapUser(data.user),
      tokens: this.mapTokens(data.tokens),
    };
  }
}
