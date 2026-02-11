import { Module } from '@nestjs/common';

import { BotAdminRepository } from './bot-admin.repository';
import { BotAdminService } from './bot-admin.service';

@Module({
  providers: [BotAdminService, BotAdminRepository],
  exports: [BotAdminService],
})
export class BotAdminModule {}
