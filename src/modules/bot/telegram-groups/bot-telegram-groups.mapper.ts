import { Injectable } from '@nestjs/common';

import {
  PaginatedTelegramGroupResponseDto,
  TelegramGroupResponseDto,
} from './dto';
import { TelegramGroupWithRelations } from './bot-telegram-groups.repository';

@Injectable()
export class BotTelegramGroupsMapper {
  mapTelegramGroup(telegramGroup: TelegramGroupWithRelations): TelegramGroupResponseDto {
    return {
      id: telegramGroup.id,
      projectId: telegramGroup.projectId,
      chatId: telegramGroup.chatId,
      title: telegramGroup.title,
      isActive: telegramGroup.isActive,
      joinedAt: telegramGroup.joinedAt,
      project: telegramGroup.project,
    };
  }

  mapPaginatedTelegramGroups(result: {
    data: TelegramGroupWithRelations[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedTelegramGroupResponseDto {
    return {
      data: result.data.map((tg) => this.mapTelegramGroup(tg)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
