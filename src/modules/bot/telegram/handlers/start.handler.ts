import { Injectable, Logger } from '@nestjs/common';

import { BotContext } from '../types/context';
import { BotAuthService } from '../../auth/bot-auth.service';
import { MenuHandler, MENU_REPLY_KEYBOARD } from './menu.handler';

@Injectable()
export class StartHandler {
  private readonly logger = new Logger(StartHandler.name);

  constructor(
    private readonly authService: BotAuthService,
    private readonly menuHandler: MenuHandler,
  ) {}

  async handleStart(ctx: BotContext): Promise<void> {
    // Already authenticated (session restored by middleware) — go straight to menu
    if (ctx.session?.userId) {
      await this.menuHandler.showMainMenu(ctx);
      return;
    }

    // Try to find user by telegramId (admin pre-registers users)
    if (ctx.from?.id) {
      try {
        const user = await this.authService.findByTelegramId(String(ctx.from.id));
        if (user && user.isActive) {
          if (!ctx.session) return;
          ctx.session.userId = user.id;
          ctx.session.orgId = user.orgId;
          ctx.session.role = user.role;
          ctx.session.userName = user.name;
          ctx.session.phone = user.phone ?? undefined;

          await ctx.reply(
            `Xush kelibsiz, ${user.name}! ✅\nRol: ${user.role}`,
            { parse_mode: 'HTML', reply_markup: MENU_REPLY_KEYBOARD },
          );
          await this.menuHandler.showMainMenu(ctx);
          return;
        }
      } catch {
        // Not found by telegramId
      }
    }

    // User not registered
    await ctx.reply(
      'Siz tizimda topilmadingiz. ❌\nAdministrator bilan bog\'laning.',
      { parse_mode: 'HTML' },
    );
  }
}
