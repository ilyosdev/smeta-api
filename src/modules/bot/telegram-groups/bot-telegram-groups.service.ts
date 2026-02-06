import { Injectable } from '@nestjs/common';

import { IUser } from 'src/common/consts/auth';
import { HandledException } from 'src/common/error/http.error';

import {
  CreateTelegramGroupDto,
  UpdateTelegramGroupDto,
  QueryTelegramGroupDto,
} from './dto';
import {
  BotTelegramGroupsRepository,
  TelegramGroupWithRelations,
} from './bot-telegram-groups.repository';

@Injectable()
export class BotTelegramGroupsService {
  constructor(private readonly repository: BotTelegramGroupsRepository) {}

  async createTelegramGroup(dto: CreateTelegramGroupDto, user: IUser): Promise<TelegramGroupWithRelations> {
    const projectOrgId = await this.repository.getProjectOrgId(dto.projectId);
    if (!projectOrgId || projectOrgId !== user.orgId) {
      HandledException.throw('PROJECT_NOT_FOUND', 404);
    }

    const existingGroup = await this.repository.findByChatId(dto.chatId);
    if (existingGroup) {
      HandledException.throw('TELEGRAM_GROUP_ALREADY_EXISTS', 400);
    }

    const telegramGroup = await this.repository.createTelegramGroup({
      projectId: dto.projectId,
      chatId: dto.chatId,
      title: dto.title,
    });

    return this.findOneTelegramGroup(telegramGroup.id, user);
  }

  async findAllTelegramGroups(
    query: QueryTelegramGroupDto,
    user: IUser,
  ): Promise<{ data: TelegramGroupWithRelations[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, projectId } = query;
    const result = await this.repository.findAllTelegramGroups(user.orgId, { page, limit, projectId });
    return { ...result, page, limit };
  }

  async findOneTelegramGroup(id: string, user: IUser): Promise<TelegramGroupWithRelations> {
    const result = await this.repository.findTelegramGroupById(id, user.orgId);
    if (!result) {
      HandledException.throw('TELEGRAM_GROUP_NOT_FOUND', 404);
    }
    return result;
  }

  async updateTelegramGroup(id: string, dto: UpdateTelegramGroupDto, user: IUser): Promise<TelegramGroupWithRelations> {
    await this.findOneTelegramGroup(id, user);
    await this.repository.updateTelegramGroup(id, dto);
    return this.findOneTelegramGroup(id, user);
  }

  async removeTelegramGroup(id: string, user: IUser): Promise<void> {
    await this.findOneTelegramGroup(id, user);
    await this.repository.deleteTelegramGroup(id);
  }

  async findByChatId(chatId: string) {
    return this.repository.findByChatId(chatId);
  }
}
