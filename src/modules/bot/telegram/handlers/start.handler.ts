import { Injectable, Logger } from '@nestjs/common';
import { Keyboard } from 'grammy';

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

    // User not found by telegramId - ask for contact (only works in private chats)
    const isPrivateChat = ctx.chat?.type === 'private';

    if (!isPrivateChat) {
      // In group chats, can't request contact - tell them to DM the bot
      await ctx.reply(
        '👋 Siz tizimda topilmadingiz.\n\n' +
        'Ro\'yxatdan o\'tish uchun menga shaxsiy xabar yuboring: @smetakonbot',
        { parse_mode: 'HTML' },
      );
      return;
    }

    const contactKeyboard = new Keyboard()
      .requestContact('📱 Telefon raqamni yuborish')
      .resized()
      .oneTime();

    await ctx.reply(
      '👋 Xush kelibsiz!\n\nTizimga kirish uchun telefon raqamingizni yuboring:',
      { parse_mode: 'HTML', reply_markup: contactKeyboard },
    );
  }

  async handleContact(ctx: BotContext): Promise<void> {
    const contact = ctx.message?.contact;
    if (!contact) return;

    const telegramId = String(ctx.from?.id);

    // Normalize phone: remove spaces, dashes, ensure + prefix
    let phone = contact.phone_number.replace(/[\s\-()]/g, '');
    if (!phone.startsWith('+')) {
      phone = '+' + phone;
    }

    this.logger.log(`Contact received: phone=${phone}, telegramId=${telegramId}`);

    // Try to find user by phone
    const user = await this.authService.findByPhone(phone);

    if (!user) {
      await ctx.reply(
        'Siz tizimda topilmadingiz. ❌\nAdministrator bilan bog\'laning.',
        { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } },
      );
      return;
    }

    if (!user.isActive) {
      await ctx.reply(
        'Sizning hisobingiz faol emas. ❌\nAdministrator bilan bog\'laning.',
        { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } },
      );
      return;
    }

    // Update user's telegramId
    await this.authService.updateTelegramId(user.id, telegramId);

    // Set session
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
  }
}
