import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { createConversation } from '@grammyjs/conversations';

import { BotAdminService } from '../../admin/bot-admin.service';
import { env } from 'src/common/config';

import { BotContext, BotConversation } from '../types/context';
import { escapeHtml } from '../helpers/format';
import { buildConfirmationKeyboard } from '../keyboards/confirmation.keyboard';
import { textWithCancel, waitForCallbackOrCancel } from '../helpers/cancel';

@Injectable()
export class SuperAdminMenu {
  private readonly logger = new Logger(SuperAdminMenu.name);

  constructor(private readonly adminService: BotAdminService) {}

  getConversationMiddleware() {
    return [
      createConversation(this.buildAddOperatorConversation(), 'sa_add_operator'),
      createConversation(this.buildAddCompanyConversation(), 'sa_add_company'),
    ];
  }

  async handleOperators(ctx: BotContext): Promise<void> {
    try {
      const result = await this.adminService.listOperators(1, 20);

      let text = `👤 <b>OPERATORLAR</b>\n\n`;

      if (result.data.length === 0) {
        text += `Operatorlar yo'q.\n`;
      } else {
        for (const op of result.data) {
          text += `👤 <b>${escapeHtml(op.name)}</b>\n`;
          text += `  📱 ${escapeHtml(op.phone || 'N/A')}\n`;
          text += `  🏢 ${escapeHtml(op.orgName)}\n`;
          text += `  ${op.isActive ? '✅ Faol' : '❌ Nofaol'}\n\n`;
        }
        text += `Jami: ${result.total} ta`;
      }

      const keyboard = new InlineKeyboard()
        .text('➕ Operator qo\'shish', 'sa:add_operator').row()
        .text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Error listing operators', error);
      await ctx.reply('Operatorlarni yuklashda xatolik yuz berdi.');
    }
  }

  async handleCompanies(ctx: BotContext): Promise<void> {
    try {
      const result = await this.adminService.listOrganizations(1, 20);

      let text = `🏢 <b>KOMPANIYALAR</b>\n\n`;

      if (result.data.length === 0) {
        text += `Kompaniyalar yo'q.\n`;
      } else {
        for (const org of result.data) {
          text += `🏢 <b>${escapeHtml(org.name)}</b>\n`;
          text += `  📱 ${escapeHtml(org.phone || 'N/A')}\n`;
          text += `  👥 ${org.userCount} ta foydalanuvchi\n`;
          text += `  ${org.isActive ? '✅ Faol' : '❌ Nofaol'}\n\n`;
        }
        text += `Jami: ${result.total} ta`;
      }

      const keyboard = new InlineKeyboard()
        .text('➕ Kompaniya qo\'shish', 'sa:add_company').row()
        .text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Error listing companies', error);
      await ctx.reply('Kompaniyalarni yuklashda xatolik yuz berdi.');
    }
  }

  async handleSettings(ctx: BotContext): Promise<void> {
    const text =
      `⚙️ <b>TIZIM SOZLAMALARI</b>\n\n` +
      `• Bot versiyasi: 1.0\n` +
      `• Rejim: ${env.NODE_ENV || 'dev'}\n` +
      `• Sana: ${new Date().toLocaleDateString('uz-UZ')}\n`;

    const keyboard = new InlineKeyboard().text('🔙 Menyu', 'main_menu');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  }

  // --- Conversations ---

  private buildAddOperatorConversation() {
    const adminService = this.adminService;

    return async function saAddOperator(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      await ctx.reply('👤 <b>OPERATOR QO\'SHISH</b>\n\nOperator ismini kiriting:\n\n<i>/cancel - bekor qilish</i>', {
        parse_mode: 'HTML',
      });
      const name = await textWithCancel(conversation, ctx, {
        otherwise: (ctx) => ctx.reply('Iltimos, matn kiriting:'),
      });

      await ctx.reply('Telefon raqamini kiriting (+998...):');
      const phone = await textWithCancel(conversation, ctx, {
        otherwise: (ctx) => ctx.reply('Iltimos, telefon raqamini kiriting:'),
      });

      // Show org list for selection
      const orgs = await conversation.external(() =>
        adminService.listOrganizations(1, 50),
      );

      if (orgs.data.length === 0) {
        await ctx.reply('Avval kompaniya qo\'shing. Operator kompaniyaga biriktirilishi kerak.');
        return;
      }

      const kb = new InlineKeyboard();
      for (const org of orgs.data) {
        kb.text(org.name, `selorg:${org.id}`).row();
      }
      await ctx.reply('Kompaniyani tanlang:', { reply_markup: kb });

      const orgCtx = await waitForCallbackOrCancel(conversation, ctx, /^selorg:/, {
        otherwise: (ctx) => ctx.reply('Iltimos, kompaniyani tanlang.'),
      });
      const orgId = orgCtx.callbackQuery!.data!.split(':')[1];
      const orgName = orgs.data.find((o) => o.id === orgId)?.name || '';
      try { await orgCtx.answerCallbackQuery(); } catch {}

      // Confirmation
      const summary =
        `👤 <b>OPERATOR QO'SHILSIN?</b>\n\n` +
        `👤 Ism: ${escapeHtml(name)}\n` +
        `📱 Telefon: ${escapeHtml(phone)}\n` +
        `🏢 Kompaniya: ${escapeHtml(orgName)}\n`;

      await ctx.reply(summary, {
        parse_mode: 'HTML',
        reply_markup: buildConfirmationKeyboard('saop', { withEdit: false }),
      });

      const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, /^saop:(confirm|cancel)/, {
        otherwise: (ctx) => ctx.reply('Iltimos, tasdiqlang yoki bekor qiling.'),
      });
      try { await confirmCtx.answerCallbackQuery(); } catch {}

      if (confirmCtx.callbackQuery!.data! === 'saop:cancel') {
        await ctx.reply('Bekor qilindi. ❌');
        return;
      }

      try {
        await conversation.external(() =>
          adminService.createOperator(name, phone, orgId),
        );
        await ctx.reply(
          `✅ Operator muvaffaqiyatli qo'shildi!\n\n` +
          `👤 ${escapeHtml(name)}\n` +
          `🏢 ${escapeHtml(orgName)}`,
          { parse_mode: 'HTML' },
        );
      } catch {
        await ctx.reply('Operatorni saqlashda xatolik yuz berdi. ❌');
      }
    };
  }

  private buildAddCompanyConversation() {
    const adminService = this.adminService;

    return async function saAddCompany(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      await ctx.reply('🏢 <b>KOMPANIYA QO\'SHISH</b>\n\nKompaniya nomini kiriting:\n\n<i>/cancel - bekor qilish</i>', {
        parse_mode: 'HTML',
      });
      const name = await textWithCancel(conversation, ctx, {
        otherwise: (ctx) => ctx.reply('Iltimos, matn kiriting:'),
      });

      await ctx.reply('Telefon raqamini kiriting (yoki o\'tkazish uchun `-`):');
      const phoneText = await textWithCancel(conversation, ctx, {
        otherwise: (ctx) => ctx.reply('Iltimos, matn kiriting:'),
      });
      const phone = phoneText === '-' ? undefined : phoneText;

      // Confirmation
      let summary = `🏢 <b>KOMPANIYA QO'SHILSIN?</b>\n\n`;
      summary += `🏢 Nom: ${escapeHtml(name)}\n`;
      if (phone) summary += `📱 Telefon: ${escapeHtml(phone)}\n`;

      await ctx.reply(summary, {
        parse_mode: 'HTML',
        reply_markup: buildConfirmationKeyboard('sacomp', { withEdit: false }),
      });

      const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, /^sacomp:(confirm|cancel)/, {
        otherwise: (ctx) => ctx.reply('Iltimos, tasdiqlang yoki bekor qiling.'),
      });
      try { await confirmCtx.answerCallbackQuery(); } catch {}

      if (confirmCtx.callbackQuery!.data! === 'sacomp:cancel') {
        await ctx.reply('Bekor qilindi. ❌');
        return;
      }

      try {
        const org = await conversation.external(() =>
          adminService.createOrganization(name, phone),
        );
        await ctx.reply(
          `✅ Kompaniya muvaffaqiyatli qo'shildi!\n\n` +
          `🏢 ${escapeHtml(org.name)}`,
          { parse_mode: 'HTML' },
        );
      } catch {
        await ctx.reply('Kompaniyani saqlashda xatolik yuz berdi. ❌');
      }
    };
  }
}
