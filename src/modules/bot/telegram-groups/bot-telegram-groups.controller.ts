import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import {
  CreateTelegramGroupDto,
  UpdateTelegramGroupDto,
  QueryTelegramGroupDto,
  TelegramGroupResponseDto,
  PaginatedTelegramGroupResponseDto,
} from './dto';
import { BotTelegramGroupsMapper } from './bot-telegram-groups.mapper';
import { BotTelegramGroupsService } from './bot-telegram-groups.service';

@ApiTags('[BOT] Telegram Groups')
@Controller('bot/telegram-groups')
export class BotTelegramGroupsController {
  constructor(
    private readonly service: BotTelegramGroupsService,
    private readonly mapper: BotTelegramGroupsMapper,
  ) {}

  @Post()
  @Endpoint('Create telegram group', true)
  @ApiOkResponse({ type: TelegramGroupResponseDto })
  async createTelegramGroup(@Body() dto: CreateTelegramGroupDto, @User() user: IUser): Promise<TelegramGroupResponseDto> {
    const result = await this.service.createTelegramGroup(dto, user);
    return this.mapper.mapTelegramGroup(result);
  }

  @Get()
  @Endpoint('Get all telegram groups', true)
  @ApiOkResponse({ type: PaginatedTelegramGroupResponseDto })
  async findAllTelegramGroups(
    @Query() query: QueryTelegramGroupDto,
    @User() user: IUser,
  ): Promise<PaginatedTelegramGroupResponseDto> {
    const result = await this.service.findAllTelegramGroups(query, user);
    return this.mapper.mapPaginatedTelegramGroups(result);
  }

  @Get('chat/:chatId')
  @Endpoint('Get telegram group by chat ID', false) // Public endpoint for bot internal use
  @ApiOkResponse({ type: TelegramGroupResponseDto })
  async findByChatId(@Param('chatId') chatId: string): Promise<TelegramGroupResponseDto | null> {
    const result = await this.service.findByChatId(chatId);
    if (!result) {
      return null;
    }
    return this.mapper.mapTelegramGroup(result);
  }

  @Get(':id')
  @Endpoint('Get telegram group by ID', true)
  @ApiOkResponse({ type: TelegramGroupResponseDto })
  async findOneTelegramGroup(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<TelegramGroupResponseDto> {
    const result = await this.service.findOneTelegramGroup(id, user);
    return this.mapper.mapTelegramGroup(result);
  }

  @Patch(':id')
  @Endpoint('Update telegram group', true)
  @ApiOkResponse({ type: TelegramGroupResponseDto })
  async updateTelegramGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTelegramGroupDto,
    @User() user: IUser,
  ): Promise<TelegramGroupResponseDto> {
    const result = await this.service.updateTelegramGroup(id, dto, user);
    return this.mapper.mapTelegramGroup(result);
  }

  @Delete(':id')
  @Endpoint('Delete telegram group', true)
  async removeTelegramGroup(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<{ success: boolean }> {
    await this.service.removeTelegramGroup(id, user);
    return { success: true };
  }
}
