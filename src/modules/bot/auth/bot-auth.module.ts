import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { BotAuthController } from './bot-auth.controller';
import { BotAuthMapper } from './bot-auth.mapper';
import { BotAuthRepository } from './bot-auth.repository';
import { BotAuthService } from './bot-auth.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [BotAuthController],
  providers: [BotAuthService, BotAuthRepository, BotAuthMapper],
  exports: [BotAuthService],
})
export class BotAuthModule {}
