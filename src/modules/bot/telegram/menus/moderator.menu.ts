import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { createConversation } from '@grammyjs/conversations';

import { VendorRequestsService } from 'src/modules/vendor/requests/vendor-requests.service';
import { VendorWarehousesService } from 'src/modules/vendor/warehouses/vendor-warehouses.service';
import { RequestStatus } from 'src/common/database/schemas';

import { BotContext, BotConversation } from '../types/context';
import { sessionToUser } from '../helpers/session-to-user';
import { escapeHtml, formatMoneyFull, parseNumber } from '../helpers/format';
import { buildConfirmationKeyboard } from '../keyboards/confirmation.keyboard';
import { textWithCancel, waitForCallbackOrCancel } from '../helpers/cancel';

@Injectable()
export class ModeratorMenu {
  private readonly logger = new Logger(ModeratorMenu.name);

  constructor(
    private readonly requestsService: VendorRequestsService,
    private readonly warehousesService: VendorWarehousesService,
  ) {}

  getConversationMiddleware() {
    return [
      createConversation(this.buildFinalizeConversation(), 'moderator_finalize'),
    ];
  }

  /**
   * Show requests in RECEIVED status waiting for price finalization
   */
  async handlePendingFinalization(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) {
        await ctx.reply('Avval tizimga kiring: /start');
        return;
      }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const projectId = ctx.session?.selectedProjectId;

      const result = await this.requestsService.findPendingFinalization(projectId, user);

      let text = `📦 <b>MAHSULOT KIRITISH</b>\n`;
      text += `🏗️ ${escapeHtml(ctx.session?.selectedProjectName || '')}\n\n`;

      if (result.data.length === 0) {
        text += `Hozircha kutilayotgan mahsulotlar yo'q.`;
      } else {
        for (const req of result.data) {
          text += `📦 <b>${escapeHtml(req.smetaItem?.name || 'Noma\'lum')}</b>\n`;
          text += `   📊 Qabul qilingan: ${req.receivedQty} ${req.smetaItem?.unit || ''}\n`;
          text += `   💰 Taxminiy: ${formatMoneyFull(req.approvedAmount || req.requestedAmount)}\n`;
          if (req.receivedAt) {
            text += `   📅 ${new Date(req.receivedAt).toLocaleDateString('uz-UZ')}\n`;
          }
          text += '\n';
        }
      }

      const keyboard = new InlineKeyboard();
      for (const req of result.data.slice(0, 10)) {
        keyboard.text(
          `📦 ${(req.smetaItem?.name || 'Noma\'lum').slice(0, 20)}`,
          `mod:finalize:${req.id}`,
        ).row();
      }
      keyboard.text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Pending finalization error', error);
      await ctx.reply('Ma\'lumotlarni yuklashda xatolik yuz berdi.');
    }
  }

  /**
   * Show finalization history (FULFILLED requests)
   */
  async handleHistory(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) {
        await ctx.reply('Avval tizimga kiring: /start');
        return;
      }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const projectId = ctx.session?.selectedProjectId;

      const result = await this.requestsService.findAll(
        { projectId, status: RequestStatus.FULFILLED, page: 1, limit: 20 },
        user,
      );

      let text = `📋 <b>YAKUNLANGAN ZAYAVKALAR</b>\n`;
      text += `🏗️ ${escapeHtml(ctx.session?.selectedProjectName || '')}\n\n`;

      if (result.data.length === 0) {
        text += `Tarix yo'q.`;
      } else {
        for (const req of result.data.slice(0, 15)) {
          text += `✅ <b>${escapeHtml(req.smetaItem?.name || 'Noma\'lum')}</b>\n`;
          text += `   📊 Miqdor: ${req.receivedQty || req.fulfilledQty || 0} ${req.smetaItem?.unit || ''}\n`;
          text += `   💰 Narx: ${formatMoneyFull(req.finalAmount || req.fulfilledAmount || 0)}\n`;
          if (req.finalizedAt) {
            text += `   📅 ${new Date(req.finalizedAt).toLocaleDateString('uz-UZ')}\n`;
          }
          text += '\n';
        }
        if (result.total > 15) {
          text += `... va yana ${result.total - 15} ta`;
        }
      }

      const keyboard = new InlineKeyboard()
        .text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('History error', error);
      await ctx.reply('Tarixni yuklashda xatolik yuz berdi.');
    }
  }

  /**
   * Start finalize conversation for a specific request
   */
  async handleFinalize(ctx: BotContext, requestId: string): Promise<void> {
    if (!ctx.session) {
      await ctx.reply('Avval tizimga kiring: /start');
      return;
    }
    ctx.session.pendingFinalizeRequestId = requestId;
    await ctx.conversation.enter('moderator_finalize');
  }

  // --- Conversation builders ---

  private buildFinalizeConversation() {
    const requestsService = this.requestsService;
    const warehousesService = this.warehousesService;

    return async function moderatorFinalize(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const requestId = await conversation.external((ctx) => ctx.session?.pendingFinalizeRequestId);
      const projectId = await conversation.external((ctx) => ctx.session?.selectedProjectId);
      if (!requestId) {
        await ctx.reply('Zayavka topilmadi. Qaytadan urinib ko\'ring.');
        return;
      }

      const user = await conversation.external((ctx) =>
        sessionToUser(ctx.session, ctx.from!.id),
      );

      // Fetch the request
      const request = await conversation.external(() =>
        requestsService.findOne(requestId, user),
      );

      if (!request) {
        await ctx.reply('Zayavka topilmadi. ❌');
        return;
      }

      if (request.status !== RequestStatus.RECEIVED) {
        await ctx.reply('Bu mahsulot allaqachon kiritilgan yoki hali qabul qilinmagan. ❌');
        return;
      }

      // Show request details
      await ctx.reply(
        `📦 <b>MAHSULOT KIRITISH</b>\n\n` +
        `📦 ${escapeHtml(request.smetaItem?.name || 'Noma\'lum')}\n` +
        `📊 Qabul qilingan: ${request.receivedQty} ${request.smetaItem?.unit || ''}\n` +
        `💰 Taxminiy summa: ${formatMoneyFull(request.approvedAmount || request.requestedAmount)}\n\n` +
        `Haqiqiy narxni (jami summa) kiriting:\n\n<i>/cancel - bekor qilish</i>`,
        { parse_mode: 'HTML' },
      );

      // Get final amount
      let finalAmount: number;
      for (;;) {
        const raw = await textWithCancel(conversation, ctx);
        finalAmount = parseNumber(raw);
        if (!isNaN(finalAmount) && finalAmount >= 0) break;
        await ctx.reply('Iltimos, to\'g\'ri raqam kiriting (masalan: 5000000 yoki 5,000,000):');
      }

      // Calculate unit price
      const finalUnitPrice = request.receivedQty ? finalAmount / request.receivedQty : finalAmount;

      // Optional note
      await ctx.reply('Izoh kiriting (yoki "yo\'q" deb yozing):', { parse_mode: 'HTML' });
      const noteRaw = await textWithCancel(conversation, ctx);
      const note = noteRaw.toLowerCase() === 'yo\'q' ? undefined : noteRaw;

      // Show confirmation
      let summary = `📋 <b>MAHSULOT KIRITILSINMI?</b>\n\n`;
      summary += `📦 ${escapeHtml(request.smetaItem?.name || '')}\n`;
      summary += `📊 Miqdor: ${request.receivedQty} ${request.smetaItem?.unit || ''}\n`;
      summary += `💰 Jami narx: ${formatMoneyFull(finalAmount)}\n`;
      summary += `💵 Birlik narxi: ${formatMoneyFull(finalUnitPrice)}\n`;
      if (note) summary += `📝 Izoh: ${escapeHtml(note)}\n`;

      await ctx.reply(summary, {
        parse_mode: 'HTML',
        reply_markup: buildConfirmationKeyboard('modfin', { withEdit: false }),
      });

      const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, /^modfin:(confirm|cancel)/, {
        otherwise: (ctx) => ctx.reply('Iltimos, tasdiqlang yoki bekor qiling.'),
      });
      try { await confirmCtx.answerCallbackQuery(); } catch {}

      if (confirmCtx.callbackQuery!.data === 'modfin:cancel') {
        await ctx.reply('Bekor qilindi. ❌');
        return;
      }

      try {
        // Finalize the request
        await conversation.external(() =>
          requestsService.finalize(requestId, {
            finalAmount,
            finalUnitPrice,
            note,
          }, user),
        );

        // Add to warehouse
        if (projectId && request.receivedQty) {
          // Get or create warehouse
          const warehouses = await conversation.external(() =>
            warehousesService.findAllWarehouses({ projectId, page: 1, limit: 1 }, user),
          );

          let warehouseId: string;
          if (warehouses.data.length === 0) {
            const newWh = await conversation.external(() =>
              warehousesService.createWarehouse({ projectId, name: 'Asosiy ombor' }, user),
            );
            warehouseId = newWh.id;
          } else {
            warehouseId = warehouses.data[0].id;
          }

          // Add item to warehouse
          await conversation.external(() =>
            warehousesService.createWarehouseItem(
              {
                warehouseId,
                name: request.smetaItem?.name || 'Noma\'lum',
                unit: request.smetaItem?.unit || 'dona',
                quantity: request.receivedQty!,
              },
              user,
            ),
          );
        }

        await ctx.reply(
          `Mahsulot kiritildi! ✅\n\n` +
          `📦 ${escapeHtml(request.smetaItem?.name || '')}\n` +
          `💰 ${formatMoneyFull(finalAmount)}\n\n` +
          `Omborga qo'shildi.`,
        );
      } catch (err: any) {
        console.error('[moderatorFinalize] error:', err?.message || err);
        await ctx.reply('Saqlashda xatolik yuz berdi. ❌');
      }
    };
  }
}
