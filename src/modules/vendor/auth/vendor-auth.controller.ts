import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import { AuthResponseDto, LoginDto, RefreshTokenDto, RegisterDto, TokensResponseDto, UserResponseDto } from './dto';
import { VendorAuthMapper } from './vendor-auth.mapper';
import { VendorAuthService } from './vendor-auth.service';

@ApiTags('[VENDOR] Auth')
@Controller('vendor/auth')
export class VendorAuthController {
  constructor(
    private readonly service: VendorAuthService,
    private readonly mapper: VendorAuthMapper,
  ) {}

  @Post('login')
  @Endpoint('Login with phone/email and password')
  @ApiOkResponse({ type: AuthResponseDto })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    const result = await this.service.login(dto);
    return this.mapper.mapAuthResponse(result);
  }

  @Post('register')
  @Endpoint('Register new organization and admin user')
  @ApiOkResponse({ type: AuthResponseDto })
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    const result = await this.service.register(dto);
    return this.mapper.mapAuthResponse(result);
  }

  @Post('refresh')
  @Endpoint('Refresh access token')
  @ApiOkResponse({ type: TokensResponseDto })
  async refresh(@Body() dto: RefreshTokenDto): Promise<TokensResponseDto> {
    const tokens = await this.service.refreshToken(dto);
    return this.mapper.mapTokens(tokens);
  }

  @Get('profile')
  @Endpoint('Get current user profile', true)
  @ApiOkResponse({ type: UserResponseDto })
  async getProfile(@User() user: IUser): Promise<UserResponseDto> {
    const profile = await this.service.getProfile(user.id);
    return this.mapper.mapUser(profile);
  }
}
