import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import { BotAuthResponseDto, BotUserResponseDto, TelegramAuthDto } from './dto';
import { BotAuthMapper } from './bot-auth.mapper';
import { BotAuthService } from './bot-auth.service';

@ApiTags('[BOT] Auth')
@Controller('bot/auth')
export class BotAuthController {
  constructor(
    private readonly service: BotAuthService,
    private readonly mapper: BotAuthMapper,
  ) {}

  @Post('telegram')
  @Endpoint('Authenticate by Telegram ID', false)
  @ApiOkResponse({ type: BotAuthResponseDto })
  async authenticateByTelegram(@Body() dto: TelegramAuthDto): Promise<BotAuthResponseDto> {
    const result = await this.service.authenticateByTelegram(dto);
    return this.mapper.mapAuthResponse(result.user, result.tokens);
  }

  @Get('profile')
  @Endpoint('Get bot user profile', true)
  @ApiOkResponse({ type: BotUserResponseDto })
  async getProfile(@User() user: IUser): Promise<BotUserResponseDto> {
    const result = await this.service.getProfile(user);
    return this.mapper.mapUser(result);
  }

  @Get('user/:telegramId')
  @Endpoint('Get user by Telegram ID', false)
  @ApiOkResponse({ type: BotUserResponseDto })
  async getUserByTelegramId(@Param('telegramId') telegramId: string): Promise<BotUserResponseDto> {
    const user = await this.service.getUserByTelegramId(telegramId);
    return this.mapper.mapUser(user);
  }
}
