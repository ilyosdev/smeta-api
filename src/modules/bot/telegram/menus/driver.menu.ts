import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { createConversation } from '@grammyjs/conversations';

import { VendorRequestsService } from 'src/modules/vendor/requests/vendor-requests.service';
import { RequestStatus } from 'src/common/database/schemas';

import { BotContext, BotConversation } from '../types/context';
import { sessionToUser } from '../helpers/session-to-user';
import { escapeHtml, formatMoneyFull, parseNumber } from '../helpers/format';
import { buildConfirmationKeyboard } from '../keyboards/confirmation.keyboard';
import { textWithCancel, waitForCallbackOrCancel } from '../helpers/cancel';

@Injectable()
export class DriverMenu {
  private readonly logger = new Logger(DriverMenu.name);

  constructor(
    private readonly requestsService: VendorRequestsService,
  ) {}

  getConversationMiddleware() {
    return [
      createConversation(this.buildCollectConversation(), 'driver_collect'),
      createConversation(this.buildDeliverConversation(), 'driver_deliver'),
    ];
  }

  /**
   * Show requests assigned to this driver (APPROVED status)
   */
  async handleAssignedRequests(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) {
        await ctx.reply('Avval tizimga kiring: /start');
        return;
      }
      const user = sessionToUser(ctx.session, ctx.from!.id);

      const result = await this.requestsService.findByDriver(user.id, RequestStatus.APPROVED, user);

      let text = `📦 <b>TAYINLANGAN ZAYAVKALAR</b>\n`;
      text += `👤 ${escapeHtml(ctx.session.userName || '')}\n\n`;

      if (result.data.length === 0) {
        text += `Hozircha tayinlangan zayavkalar yo'q.`;
      } else {
        for (const req of result.data) {
          text += `📦 <b>${escapeHtml(req.smetaItem?.name || 'Noma\'lum')}</b>\n`;
          text += `   📊 Miqdor: ${req.approvedQty || req.requestedQty} ${req.smetaItem?.unit || ''}\n`;
          text += `   💰 Summa: ${formatMoneyFull(req.approvedAmount || req.requestedAmount)}\n`;
          if (req.requestedBy?.name) {
            text += `   👷 Prorab: ${escapeHtml(req.requestedBy.name)}\n`;
          }
          if (req.note) {
            text += `   📝 ${escapeHtml(req.note)}\n`;
          }
          text += '\n';
        }
      }

      const keyboard = new InlineKeyboard();
      for (const req of result.data.slice(0, 10)) {
        keyboard.text(
          `📦 ${(req.smetaItem?.name || 'Noma\'lum').slice(0, 20)}`,
          `driver:collect:${req.id}`,
        ).row();
      }
      keyboard.text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Assigned requests error', error);
      await ctx.reply('Zayavkalarni yuklashda xatolik yuz berdi.');
    }
  }

  /**
   * Show active deliveries (IN_TRANSIT status)
   */
  async handleActiveDeliveries(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) {
        await ctx.reply('Avval tizimga kiring: /start');
        return;
      }
      const user = sessionToUser(ctx.session, ctx.from!.id);

      const result = await this.requestsService.findByDriver(user.id, RequestStatus.IN_TRANSIT, user);

      let text = `🚚 <b>FAOL YETKAZMALAR</b>\n`;
      text += `👤 ${escapeHtml(ctx.session.userName || '')}\n\n`;

      if (result.data.length === 0) {
        text += `Hozircha faol yetkazmalar yo'q.`;
      } else {
        for (const req of result.data) {
          text += `🚚 <b>${escapeHtml(req.smetaItem?.name || 'Noma\'lum')}</b>\n`;
          text += `   📊 Yig'ilgan: ${req.collectedQty} ${req.smetaItem?.unit || ''}\n`;
          if (req.collectionNote) {
            text += `   📝 ${escapeHtml(req.collectionNote)}\n`;
          }
          if (req.collectedAt) {
            text += `   🕐 ${new Date(req.collectedAt).toLocaleString('uz-UZ')}\n`;
          }
          text += '\n';
        }
      }

      const keyboard = new InlineKeyboard();
      for (const req of result.data.slice(0, 10)) {
        keyboard.text(
          `🚚 ${(req.smetaItem?.name || 'Noma\'lum').slice(0, 20)}`,
          `driver:deliver:${req.id}`,
        ).row();
      }
      keyboard.text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Active deliveries error', error);
      await ctx.reply('Yetkazmalarni yuklashda xatolik yuz berdi.');
    }
  }

  /**
   * Show delivery history (DELIVERED + FULFILLED)
   */
  async handleDeliveryHistory(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) {
        await ctx.reply('Avval tizimga kiring: /start');
        return;
      }
      const user = sessionToUser(ctx.session, ctx.from!.id);

      // Get both DELIVERED and FULFILLED requests
      const delivered = await this.requestsService.findByDriver(user.id, RequestStatus.DELIVERED, user);
      const fulfilled = await this.requestsService.findByDriver(user.id, RequestStatus.FULFILLED, user);
      const allHistory = [...delivered.data, ...fulfilled.data];

      let text = `📋 <b>YETKAZMA TARIXI</b>\n`;
      text += `👤 ${escapeHtml(ctx.session.userName || '')}\n\n`;

      if (allHistory.length === 0) {
        text += `Tarix yo'q.`;
      } else {
        for (const req of allHistory.slice(0, 15)) {
          const statusIcon = req.status === RequestStatus.FULFILLED ? '✅' : '🟡';
          text += `${statusIcon} <b>${escapeHtml(req.smetaItem?.name || 'Noma\'lum')}</b>\n`;
          text += `   📊 Yetkazilgan: ${req.deliveredQty || req.collectedQty || 0} ${req.smetaItem?.unit || ''}\n`;
          if (req.deliveredAt) {
            text += `   📅 ${new Date(req.deliveredAt).toLocaleDateString('uz-UZ')}\n`;
          }
          text += '\n';
        }
        if (allHistory.length > 15) {
          text += `... va yana ${allHistory.length - 15} ta`;
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
      this.logger.error('Delivery history error', error);
      await ctx.reply('Tarixni yuklashda xatolik yuz berdi.');
    }
  }

  /**
   * Start collect conversation for a specific request
   */
  async handleCollect(ctx: BotContext, requestId: string): Promise<void> {
    if (!ctx.session) {
      await ctx.reply('Avval tizimga kiring: /start');
      return;
    }
    ctx.session.pendingCollectRequestId = requestId;
    await ctx.conversation.enter('driver_collect');
  }

  /**
   * Start deliver conversation for a specific request
   */
  async handleDeliver(ctx: BotContext, requestId: string): Promise<void> {
    if (!ctx.session) {
      await ctx.reply('Avval tizimga kiring: /start');
      return;
    }
    ctx.session.pendingDeliverRequestId = requestId;
    await ctx.conversation.enter('driver_deliver');
  }

  // --- Conversation builders ---

  private buildCollectConversation() {
    const requestsService = this.requestsService;

    return async function driverCollect(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const requestId = await conversation.external((ctx) => ctx.session?.pendingCollectRequestId);
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

      if (request.status !== RequestStatus.APPROVED) {
        await ctx.reply('Bu zayavka allaqachon yig\'ilgan yoki bekor qilingan. ❌');
        return;
      }

      // Show request details and ask for collected quantity
      const expectedQty = request.approvedQty || request.requestedQty;
      await ctx.reply(
        `📦 <b>MATERIAL YIG'ISH</b>\n\n` +
        `📦 ${escapeHtml(request.smetaItem?.name || 'Noma\'lum')}\n` +
        `📊 Kutilayotgan miqdor: ${expectedQty} ${request.smetaItem?.unit || ''}\n` +
        `💰 Summa: ${formatMoneyFull(request.approvedAmount || request.requestedAmount)}\n\n` +
        `Yig'ilgan miqdorni kiriting:\n\n<i>/cancel - bekor qilish</i>`,
        { parse_mode: 'HTML' },
      );

      let collectedQty: number;
      for (;;) {
        const raw = await textWithCancel(conversation, ctx);
        collectedQty = parseNumber(raw);
        if (!isNaN(collectedQty) && collectedQty >= 0) break;
        await ctx.reply('Iltimos, to\'g\'ri raqam kiriting (masalan: 500000 yoki 500,000):');
      }

      // Optional note
      await ctx.reply('Izoh kiriting (yoki "yo\'q" deb yozing):', { parse_mode: 'HTML' });
      const noteRaw = await textWithCancel(conversation, ctx);
      const note = noteRaw.toLowerCase() === 'yo\'q' ? undefined : noteRaw;

      // Optional photo
      await ctx.reply('📸 Rasm yuboring (yoki "yo\'q" deb yozing):', { parse_mode: 'HTML' });
      let photoFileId: string | undefined;
      for (;;) {
        const photoCtx = await conversation.wait();
        if (photoCtx.message?.text === '/cancel' || photoCtx.callbackQuery?.data === 'conv:cancel') {
          if (photoCtx.callbackQuery) { try { await photoCtx.answerCallbackQuery(); } catch {} }
          await ctx.reply('Bekor qilindi. ❌');
          return;
        }
        if (photoCtx.message?.text?.toLowerCase() === 'yo\'q') {
          break;
        }
        if (photoCtx.message?.photo) {
          const photos = photoCtx.message.photo;
          photoFileId = photos[photos.length - 1].file_id;
          break;
        }
        await ctx.reply('Iltimos, rasm yuboring yoki "yo\'q" deb yozing:');
      }

      // Show confirmation
      let summary = `📋 <b>YIG'ISH TASDIQLANSIN?</b>\n\n`;
      summary += `📦 ${escapeHtml(request.smetaItem?.name || '')}\n`;
      summary += `📊 Yig'ilgan miqdor: ${collectedQty} ${request.smetaItem?.unit || ''}\n`;
      if (note) summary += `📝 Izoh: ${escapeHtml(note)}\n`;
      if (photoFileId) summary += `📸 Rasm: Ha\n`;

      await ctx.reply(summary, {
        parse_mode: 'HTML',
        reply_markup: buildConfirmationKeyboard('drvcol', { withEdit: false }),
      });

      const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, /^drvcol:(confirm|cancel)/, {
        otherwise: (ctx) => ctx.reply('Iltimos, tasdiqlang yoki bekor qiling.'),
      });
      try { await confirmCtx.answerCallbackQuery(); } catch {}

      if (confirmCtx.callbackQuery!.data === 'drvcol:cancel') {
        await ctx.reply('Bekor qilindi. ❌');
        return;
      }

      try {
        await conversation.external(() =>
          requestsService.markCollected(requestId, {
            collectedQty,
            note,
            photoFileId,
          }, user),
        );
        await ctx.reply('Material yig\'ildi! ✅\n\nEndi yetkazma ro\'yxatida ko\'rinadi.');
      } catch (err: any) {
        console.error('[driverCollect] error:', err?.message || err);
        await ctx.reply('Saqlashda xatolik yuz berdi. ❌');
      }
    };
  }

  private buildDeliverConversation() {
    const requestsService = this.requestsService;

    return async function driverDeliver(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const requestId = await conversation.external((ctx) => ctx.session?.pendingDeliverRequestId);
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

      if (request.status !== RequestStatus.IN_TRANSIT) {
        await ctx.reply('Bu zayavka yetkazma rejimida emas. ❌');
        return;
      }

      // Show request details and ask for delivered quantity
      await ctx.reply(
        `🚚 <b>YETKAZMA TASDIQLASH</b>\n\n` +
        `📦 ${escapeHtml(request.smetaItem?.name || 'Noma\'lum')}\n` +
        `📊 Yig'ilgan: ${request.collectedQty} ${request.smetaItem?.unit || ''}\n\n` +
        `Yetkazilgan miqdorni kiriting:\n\n<i>/cancel - bekor qilish</i>`,
        { parse_mode: 'HTML' },
      );

      let deliveredQty: number;
      for (;;) {
        const raw = await textWithCancel(conversation, ctx);
        deliveredQty = parseNumber(raw);
        if (!isNaN(deliveredQty) && deliveredQty >= 0) break;
        await ctx.reply('Iltimos, to\'g\'ri raqam kiriting (masalan: 500000 yoki 500,000):');
      }

      // Optional note
      await ctx.reply('Izoh kiriting (yoki "yo\'q" deb yozing):', { parse_mode: 'HTML' });
      const noteRaw = await textWithCancel(conversation, ctx);
      const note = noteRaw.toLowerCase() === 'yo\'q' ? undefined : noteRaw;

      // Optional photo
      await ctx.reply('📸 Rasm yuboring (yoki "yo\'q" deb yozing):', { parse_mode: 'HTML' });
      let photoFileId: string | undefined;
      for (;;) {
        const photoCtx = await conversation.wait();
        if (photoCtx.message?.text === '/cancel' || photoCtx.callbackQuery?.data === 'conv:cancel') {
          if (photoCtx.callbackQuery) { try { await photoCtx.answerCallbackQuery(); } catch {} }
          await ctx.reply('Bekor qilindi. ❌');
          return;
        }
        if (photoCtx.message?.text?.toLowerCase() === 'yo\'q') {
          break;
        }
        if (photoCtx.message?.photo) {
          const photos = photoCtx.message.photo;
          photoFileId = photos[photos.length - 1].file_id;
          break;
        }
        await ctx.reply('Iltimos, rasm yuboring yoki "yo\'q" deb yozing:');
      }

      // Show confirmation
      let summary = `📋 <b>YETKAZMA TASDIQLANSIN?</b>\n\n`;
      summary += `📦 ${escapeHtml(request.smetaItem?.name || '')}\n`;
      summary += `📊 Yetkazilgan miqdor: ${deliveredQty} ${request.smetaItem?.unit || ''}\n`;
      if (note) summary += `📝 Izoh: ${escapeHtml(note)}\n`;
      if (photoFileId) summary += `📸 Rasm: Ha\n`;

      await ctx.reply(summary, {
        parse_mode: 'HTML',
        reply_markup: buildConfirmationKeyboard('drvdel', { withEdit: false }),
      });

      const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, /^drvdel:(confirm|cancel)/, {
        otherwise: (ctx) => ctx.reply('Iltimos, tasdiqlang yoki bekor qiling.'),
      });
      try { await confirmCtx.answerCallbackQuery(); } catch {}

      if (confirmCtx.callbackQuery!.data === 'drvdel:cancel') {
        await ctx.reply('Bekor qilindi. ❌');
        return;
      }

      try {
        await conversation.external(() =>
          requestsService.markDelivered(requestId, {
            deliveredQty,
            note,
            photoFileId,
          }, user),
        );
        await ctx.reply('Yetkazma tasdiqlandi! ✅\n\nSkladchi qabul qilishi kerak.');
      } catch (err: any) {
        console.error('[driverDeliver] error:', err?.message || err);
        await ctx.reply('Saqlashda xatolik yuz berdi. ❌');
      }
    };
  }
}
