import { Module } from '@nestjs/common';

import { BotTelegramGroupsController } from './bot-telegram-groups.controller';
import { BotTelegramGroupsMapper } from './bot-telegram-groups.mapper';
import { BotTelegramGroupsRepository } from './bot-telegram-groups.repository';
import { BotTelegramGroupsService } from './bot-telegram-groups.service';

@Module({
  controllers: [BotTelegramGroupsController],
  providers: [BotTelegramGroupsService, BotTelegramGroupsRepository, BotTelegramGroupsMapper],
  exports: [BotTelegramGroupsService],
})
export class BotTelegramGroupsModule {}
