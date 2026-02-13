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
      createConversation(this.buildCollectBatchConversation(), 'driver_collect_batch'),
      createConversation(this.buildDeliverBatchConversation(), 'driver_deliver_batch'),
    ];
  }

  /**
   * Show requests assigned to this driver (APPROVED status) - grouped by batchId
   */
  async handleAssignedRequests(ctx: BotContext, index?: number): Promise<void> {
    try {
      if (!ctx.session?.userId) {
        await ctx.reply('Avval tizimga kiring: /start');
        return;
      }
      const user = sessionToUser(ctx.session, ctx.from!.id);

      this.logger.log(`[handleAssignedRequests] userId=${user.id}, orgId=${user.orgId}, role=${user.role}`);

      const result = await this.requestsService.findByDriver(user.id, RequestStatus.APPROVED, user);

      this.logger.log(`[handleAssignedRequests] found ${result.data.length} requests`);

      let text = `📦 <b>TAYINLANGAN ZAYAVKALAR</b>\n`;
      text += `👤 ${escapeHtml(ctx.session.userName || '')}\n\n`;

      if (result.data.length === 0) {
        text += `Hozircha tayinlangan zayavkalar yo'q.`;
        const keyboard = new InlineKeyboard().text('🔙 Menyu', 'main_menu');
        if (ctx.callbackQuery) {
          await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
        } else {
          await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
        }
        return;
      }

      // Group requests by batchId (null batchId = individual request)
      type RequestBatch = { batchId: string | null; requests: typeof result.data; prorabName: string };
      const batchMap = new Map<string, RequestBatch>();

      for (const req of result.data) {
        const key = req.batchId || `single_${req.id}`;
        if (!batchMap.has(key)) {
          batchMap.set(key, {
            batchId: req.batchId || null,
            requests: [],
            prorabName: req.requestedBy?.name || 'Noma\'lum',
          });
        }
        batchMap.get(key)!.requests.push(req);
      }

      const batches = Array.from(batchMap.values());

      // Cache batch keys for navigation
      ctx.session.driverAssignedIds = batches.map((b) => b.requests[0].id);

      // Determine current batch index
      const currentIndex = index ?? ctx.session.driverAssignedIndex ?? 0;
      const safeIndex = Math.max(0, Math.min(currentIndex, batches.length - 1));
      ctx.session.driverAssignedIndex = safeIndex;

      const batch = batches[safeIndex];
      const totalBatches = batches.length;

      // Show Prorab name
      text += `👷 <b>${escapeHtml(batch.prorabName)}</b>\n\n`;

      // List all items in this batch
      for (let i = 0; i < batch.requests.length; i++) {
        const req = batch.requests[i];
        text += `📦 <b>${escapeHtml(req.smetaItem?.name || 'Noma\'lum')}</b>\n`;
        text += `   📊 Miqdor: ${req.approvedQty || req.requestedQty} ${req.smetaItem?.unit || ''}\n`;
        text += `   💰 Summa: ${formatMoneyFull(req.approvedAmount || req.requestedAmount)}\n`;
        if (req.note) {
          text += `   📝 ${escapeHtml(req.note)}\n`;
        }
        if (i < batch.requests.length - 1) text += '\n';
      }

      if (batch.requests.length > 1) {
        text += `\n<b>Jami: ${batch.requests.length} ta zayavka</b>`;
      }

      const keyboard = new InlineKeyboard();

      // Navigation row (only if more than 1 batch)
      if (totalBatches > 1) {
        keyboard.text('◀️ Oldingi', 'driver:assigned_prev');
        keyboard.text(`${safeIndex + 1}/${totalBatches}`, 'noop');
        keyboard.text('Keyingi ▶️', 'driver:assigned_next');
        keyboard.row();
      }

      // Action buttons - if batch has multiple items, show "collect all" option
      if (batch.requests.length === 1) {
        keyboard.text('📦 Yig\'ish', `driver:collect:${batch.requests[0].id}`).row();
      } else {
        // For batch - show individual collect buttons or batch collect
        const firstReqId = batch.requests[0].id;
        keyboard.text('📦 Barchasini yig\'ish', `driver:collectbatch:${firstReqId}`).row();
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

  async handleAssignedPrev(ctx: BotContext): Promise<void> {
    const currentIndex = ctx.session?.driverAssignedIndex ?? 0;
    const total = ctx.session?.driverAssignedIds?.length ?? 0;
    const newIndex = currentIndex > 0 ? currentIndex - 1 : total - 1;
    await this.handleAssignedRequests(ctx, newIndex);
  }

  async handleAssignedNext(ctx: BotContext): Promise<void> {
    const currentIndex = ctx.session?.driverAssignedIndex ?? 0;
    const total = ctx.session?.driverAssignedIds?.length ?? 0;
    const newIndex = currentIndex < total - 1 ? currentIndex + 1 : 0;
    await this.handleAssignedRequests(ctx, newIndex);
  }

  /**
   * Show active deliveries (IN_TRANSIT status) - grouped by batchId
   */
  async handleActiveDeliveries(ctx: BotContext, index?: number): Promise<void> {
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
        const keyboard = new InlineKeyboard().text('🔙 Menyu', 'main_menu');
        if (ctx.callbackQuery) {
          await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
        } else {
          await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
        }
        return;
      }

      // Group requests by batchId
      type RequestBatch = { batchId: string | null; requests: typeof result.data; prorabName: string };
      const batchMap = new Map<string, RequestBatch>();

      for (const req of result.data) {
        const key = req.batchId || `single_${req.id}`;
        if (!batchMap.has(key)) {
          batchMap.set(key, {
            batchId: req.batchId || null,
            requests: [],
            prorabName: req.requestedBy?.name || 'Noma\'lum',
          });
        }
        batchMap.get(key)!.requests.push(req);
      }

      const batches = Array.from(batchMap.values());

      // Cache batch keys for navigation
      ctx.session.driverActiveIds = batches.map((b) => b.requests[0].id);

      // Determine current batch index
      const currentIndex = index ?? ctx.session.driverActiveIndex ?? 0;
      const safeIndex = Math.max(0, Math.min(currentIndex, batches.length - 1));
      ctx.session.driverActiveIndex = safeIndex;

      const batch = batches[safeIndex];
      const totalBatches = batches.length;

      // Show Prorab name
      text += `👷 <b>${escapeHtml(batch.prorabName)}</b>\n\n`;

      // List all items in this batch
      for (let i = 0; i < batch.requests.length; i++) {
        const req = batch.requests[i];
        text += `🚚 <b>${escapeHtml(req.smetaItem?.name || 'Noma\'lum')}</b>\n`;
        text += `   📊 Yig'ilgan: ${req.collectedQty} ${req.smetaItem?.unit || ''}\n`;
        if (req.collectionNote) {
          text += `   📝 ${escapeHtml(req.collectionNote)}\n`;
        }
        if (req.collectedAt) {
          text += `   🕐 ${new Date(req.collectedAt).toLocaleString('uz-UZ')}\n`;
        }
        if (i < batch.requests.length - 1) text += '\n';
      }

      if (batch.requests.length > 1) {
        text += `\n<b>Jami: ${batch.requests.length} ta yetkazma</b>`;
      }

      const keyboard = new InlineKeyboard();

      // Navigation row (only if more than 1 batch)
      if (totalBatches > 1) {
        keyboard.text('◀️ Oldingi', 'driver:active_prev');
        keyboard.text(`${safeIndex + 1}/${totalBatches}`, 'noop');
        keyboard.text('Keyingi ▶️', 'driver:active_next');
        keyboard.row();
      }

      // Action buttons
      if (batch.requests.length === 1) {
        keyboard.text('🚚 Yetkazish', `driver:deliver:${batch.requests[0].id}`).row();
      } else {
        const firstReqId = batch.requests[0].id;
        keyboard.text('🚚 Barchasini yetkazish', `driver:deliverbatch:${firstReqId}`).row();
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

  async handleActivePrev(ctx: BotContext): Promise<void> {
    const currentIndex = ctx.session?.driverActiveIndex ?? 0;
    const total = ctx.session?.driverActiveIds?.length ?? 0;
    const newIndex = currentIndex > 0 ? currentIndex - 1 : total - 1;
    await this.handleActiveDeliveries(ctx, newIndex);
  }

  async handleActiveNext(ctx: BotContext): Promise<void> {
    const currentIndex = ctx.session?.driverActiveIndex ?? 0;
    const total = ctx.session?.driverActiveIds?.length ?? 0;
    const newIndex = currentIndex < total - 1 ? currentIndex + 1 : 0;
    await this.handleActiveDeliveries(ctx, newIndex);
  }

  /**
   * Show delivery history (DELIVERED + FULFILLED) - one-by-one carousel
   */
  async handleDeliveryHistory(ctx: BotContext, index?: number): Promise<void> {
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

      // Cache IDs for navigation
      ctx.session.driverHistoryIds = allHistory.map((r) => r.id);

      let text = `📋 <b>YETKAZMA TARIXI</b>\n`;
      text += `👤 ${escapeHtml(ctx.session.userName || '')}\n\n`;

      if (allHistory.length === 0) {
        text += `Tarix yo'q.`;
        const keyboard = new InlineKeyboard().text('🔙 Menyu', 'main_menu');
        if (ctx.callbackQuery) {
          await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
        } else {
          await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
        }
        return;
      }

      // Determine current index
      const currentIndex = index ?? ctx.session.driverHistoryIndex ?? 0;
      const safeIndex = Math.max(0, Math.min(currentIndex, allHistory.length - 1));
      ctx.session.driverHistoryIndex = safeIndex;

      const req = allHistory[safeIndex];
      const total = allHistory.length;
      const statusIcon = req.status === RequestStatus.FULFILLED ? '✅' : '🟡';

      text += `${statusIcon} <b>${escapeHtml(req.smetaItem?.name || 'Noma\'lum')}</b>\n`;
      text += `   📊 Yetkazilgan: ${req.deliveredQty || req.collectedQty || 0} ${req.smetaItem?.unit || ''}\n`;
      if (req.deliveredAt) {
        text += `   📅 ${new Date(req.deliveredAt).toLocaleDateString('uz-UZ')}\n`;
      }

      const keyboard = new InlineKeyboard();

      // Navigation row (only if more than 1 item)
      if (total > 1) {
        keyboard.text('◀️ Oldingi', 'driver:history_prev');
        keyboard.text(`${safeIndex + 1}/${total}`, 'noop');
        keyboard.text('Keyingi ▶️', 'driver:history_next');
        keyboard.row();
      }

      keyboard.text('🔙 Menyu', 'main_menu');

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

  async handleHistoryPrev(ctx: BotContext): Promise<void> {
    const currentIndex = ctx.session?.driverHistoryIndex ?? 0;
    const total = ctx.session?.driverHistoryIds?.length ?? 0;
    const newIndex = currentIndex > 0 ? currentIndex - 1 : total - 1;
    await this.handleDeliveryHistory(ctx, newIndex);
  }

  async handleHistoryNext(ctx: BotContext): Promise<void> {
    const currentIndex = ctx.session?.driverHistoryIndex ?? 0;
    const total = ctx.session?.driverHistoryIds?.length ?? 0;
    const newIndex = currentIndex < total - 1 ? currentIndex + 1 : 0;
    await this.handleDeliveryHistory(ctx, newIndex);
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

  /**
   * Start batch collect conversation (for multiple requests in same batch)
   */
  async handleCollectBatch(ctx: BotContext, firstRequestId: string): Promise<void> {
    if (!ctx.session) {
      await ctx.reply('Avval tizimga kiring: /start');
      return;
    }
    ctx.session.pendingCollectBatchId = firstRequestId;
    await ctx.conversation.enter('driver_collect_batch');
  }

  /**
   * Start batch deliver conversation (for multiple requests in same batch)
   */
  async handleDeliverBatch(ctx: BotContext, firstRequestId: string): Promise<void> {
    if (!ctx.session) {
      await ctx.reply('Avval tizimga kiring: /start');
      return;
    }
    ctx.session.pendingDeliverBatchId = firstRequestId;
    await ctx.conversation.enter('driver_deliver_batch');
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

      // Mandatory photo
      await ctx.reply(
        '📸 <b>MUHIM!</b> Yig\'ilgan mahsulot rasmini yuboring:\n\n' +
        '<i>Rasm yubormasdan tasdiqlash mumkin emas</i>\n' +
        '<i>/cancel - bekor qilish</i>',
        { parse_mode: 'HTML' },
      );
      let photoFileId: string;
      for (;;) {
        const photoCtx = await conversation.wait();
        if (photoCtx.message?.text === '/cancel' || photoCtx.callbackQuery?.data === 'conv:cancel') {
          if (photoCtx.callbackQuery) { try { await photoCtx.answerCallbackQuery(); } catch {} }
          await ctx.reply('Bekor qilindi. ❌');
          return;
        }
        if (photoCtx.message?.photo) {
          const photos = photoCtx.message.photo;
          photoFileId = photos[photos.length - 1].file_id;
          break;
        }
        await ctx.reply('📸 Iltimos, rasm yuboring (majburiy):');
      }

      // Show confirmation
      let summary = `📋 <b>YIG'ISH TASDIQLANSIN?</b>\n\n`;
      summary += `📦 ${escapeHtml(request.smetaItem?.name || '')}\n`;
      summary += `📊 Yig'ilgan miqdor: ${collectedQty} ${request.smetaItem?.unit || ''}\n`;
      if (note) summary += `📝 Izoh: ${escapeHtml(note)}\n`;
      summary += `📸 Rasm: Ha\n`;

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

      // Mandatory photo
      await ctx.reply(
        '📸 <b>MUHIM!</b> Yetkazilgan mahsulot rasmini yuboring:\n\n' +
        '<i>Rasm yubormasdan tasdiqlash mumkin emas</i>\n' +
        '<i>/cancel - bekor qilish</i>',
        { parse_mode: 'HTML' },
      );
      let photoFileId: string;
      for (;;) {
        const photoCtx = await conversation.wait();
        if (photoCtx.message?.text === '/cancel' || photoCtx.callbackQuery?.data === 'conv:cancel') {
          if (photoCtx.callbackQuery) { try { await photoCtx.answerCallbackQuery(); } catch {} }
          await ctx.reply('Bekor qilindi. ❌');
          return;
        }
        if (photoCtx.message?.photo) {
          const photos = photoCtx.message.photo;
          photoFileId = photos[photos.length - 1].file_id;
          break;
        }
        await ctx.reply('📸 Iltimos, rasm yuboring (majburiy):');
      }

      // Show confirmation
      let summary = `📋 <b>YETKAZMA TASDIQLANSIN?</b>\n\n`;
      summary += `📦 ${escapeHtml(request.smetaItem?.name || '')}\n`;
      summary += `📊 Yetkazilgan miqdor: ${deliveredQty} ${request.smetaItem?.unit || ''}\n`;
      if (note) summary += `📝 Izoh: ${escapeHtml(note)}\n`;
      summary += `📸 Rasm: Ha\n`;

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

  private buildCollectBatchConversation() {
    const requestsService = this.requestsService;

    return async function driverCollectBatch(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const firstRequestId = await conversation.external((ctx) => ctx.session?.pendingCollectBatchId);
      if (!firstRequestId) {
        await ctx.reply('Zayavkalar topilmadi. Qaytadan urinib ko\'ring.');
        return;
      }

      const user = await conversation.external((ctx) =>
        sessionToUser(ctx.session, ctx.from!.id),
      );

      // Get first request to find batchId
      const firstReq = await conversation.external(() => requestsService.findOne(firstRequestId, user));
      if (!firstReq || !firstReq.batchId) {
        await ctx.reply('Zayavka topilmadi. ❌');
        return;
      }

      // Fetch all APPROVED requests with same batchId assigned to this driver
      const allApproved = await conversation.external(() =>
        requestsService.findByDriver(user.id, RequestStatus.APPROVED, user),
      );
      const requests = allApproved.data.filter((r: any) => r.batchId === firstReq.batchId);

      if (requests.length === 0) {
        await ctx.reply('Zayavkalar topilmadi yoki allaqachon yig\'ilgan. ❌');
        return;
      }

      // Show batch summary
      let summary = `📦 <b>BARCHASI YIG'ILSIN</b>\n\n`;
      summary += `👷 <b>${escapeHtml(requests[0].requestedBy?.name || '')}</b>\n\n`;
      for (const req of requests) {
        summary += `📦 ${escapeHtml(req.smetaItem?.name || 'Noma\'lum')} — ${req.approvedQty || req.requestedQty} ${req.smetaItem?.unit || ''}\n`;
      }
      summary += `\n<b>Jami: ${requests.length} ta zayavka</b>\n\n`;
      summary += `Yig'ish uchun umumiy izoh kiriting (yoki "yo'q"):\n\n<i>/cancel - bekor qilish</i>`;

      await ctx.reply(summary, { parse_mode: 'HTML' });

      const noteRaw = await textWithCancel(conversation, ctx);
      const note = noteRaw.toLowerCase() === 'yo\'q' ? undefined : noteRaw;

      // Mandatory photo for batch
      await ctx.reply(
        '📸 <b>MUHIM!</b> Yig\'ilgan mahsulotlar rasmini yuboring:\n\n' +
        '<i>Rasm yubormasdan tasdiqlash mumkin emas</i>\n' +
        '<i>/cancel - bekor qilish</i>',
        { parse_mode: 'HTML' },
      );
      let photoFileId: string;
      for (;;) {
        const photoCtx = await conversation.wait();
        if (photoCtx.message?.text === '/cancel' || photoCtx.callbackQuery?.data === 'conv:cancel') {
          if (photoCtx.callbackQuery) { try { await photoCtx.answerCallbackQuery(); } catch {} }
          await ctx.reply('Bekor qilindi. ❌');
          return;
        }
        if (photoCtx.message?.photo) {
          const photos = photoCtx.message.photo;
          photoFileId = photos[photos.length - 1].file_id;
          break;
        }
        await ctx.reply('📸 Iltimos, rasm yuboring (majburiy):');
      }

      // Confirmation
      await ctx.reply(
        `📋 <b>YIG'ISH TASDIQLANSIN?</b>\n\n` +
        `${requests.length} ta zayavka yig'iladi.\n` +
        (note ? `📝 Izoh: ${escapeHtml(note)}\n` : '') +
        `📸 Rasm: Ha`,
        {
          parse_mode: 'HTML',
          reply_markup: buildConfirmationKeyboard('drvcolbatch', { withEdit: false }),
        },
      );

      const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, /^drvcolbatch:(confirm|cancel)/, {
        otherwise: (ctx) => ctx.reply('Iltimos, tasdiqlang yoki bekor qiling.'),
      });
      try { await confirmCtx.answerCallbackQuery(); } catch {}

      if (confirmCtx.callbackQuery!.data === 'drvcolbatch:cancel') {
        await ctx.reply('Bekor qilindi. ❌');
        return;
      }

      // Mark all requests as collected
      let successCount = 0;
      for (const req of requests) {
        try {
          await conversation.external(() =>
            requestsService.markCollected(req.id, {
              collectedQty: req.approvedQty || req.requestedQty,
              note,
              photoFileId,
            }, user),
          );
          successCount++;
        } catch (err: any) {
          console.error(`[driverCollectBatch] Error collecting ${req.id}:`, err?.message || err);
        }
      }

      await ctx.reply(`${successCount} ta material yig'ildi! ✅\n\nEndi yetkazma ro'yxatida ko'rinadi.`);
    };
  }

  private buildDeliverBatchConversation() {
    const requestsService = this.requestsService;

    return async function driverDeliverBatch(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const firstRequestId = await conversation.external((ctx) => ctx.session?.pendingDeliverBatchId);
      if (!firstRequestId) {
        await ctx.reply('Yetkazmalar topilmadi. Qaytadan urinib ko\'ring.');
        return;
      }

      const user = await conversation.external((ctx) =>
        sessionToUser(ctx.session, ctx.from!.id),
      );

      // Get first request to find batchId
      const firstReq = await conversation.external(() => requestsService.findOne(firstRequestId, user));
      if (!firstReq || !firstReq.batchId) {
        await ctx.reply('Yetkazma topilmadi. ❌');
        return;
      }

      // Fetch all IN_TRANSIT requests with same batchId assigned to this driver
      const allInTransit = await conversation.external(() =>
        requestsService.findByDriver(user.id, RequestStatus.IN_TRANSIT, user),
      );
      const requests = allInTransit.data.filter((r: any) => r.batchId === firstReq.batchId);

      if (requests.length === 0) {
        await ctx.reply('Yetkazmalar topilmadi yoki allaqachon yetkazilgan. ❌');
        return;
      }

      // Show batch summary
      let summary = `🚚 <b>BARCHASI YETKAZILSIN</b>\n\n`;
      summary += `👷 <b>${escapeHtml(requests[0].requestedBy?.name || '')}</b>\n\n`;
      for (const req of requests) {
        summary += `🚚 ${escapeHtml(req.smetaItem?.name || 'Noma\'lum')} — ${req.collectedQty} ${req.smetaItem?.unit || ''}\n`;
      }
      summary += `\n<b>Jami: ${requests.length} ta yetkazma</b>\n\n`;
      summary += `Yetkazish uchun umumiy izoh kiriting (yoki "yo'q"):\n\n<i>/cancel - bekor qilish</i>`;

      await ctx.reply(summary, { parse_mode: 'HTML' });

      const noteRaw = await textWithCancel(conversation, ctx);
      const note = noteRaw.toLowerCase() === 'yo\'q' ? undefined : noteRaw;

      // Mandatory photo for batch
      await ctx.reply(
        '📸 <b>MUHIM!</b> Yetkazilgan mahsulotlar rasmini yuboring:\n\n' +
        '<i>Rasm yubormasdan tasdiqlash mumkin emas</i>\n' +
        '<i>/cancel - bekor qilish</i>',
        { parse_mode: 'HTML' },
      );
      let photoFileId: string;
      for (;;) {
        const photoCtx = await conversation.wait();
        if (photoCtx.message?.text === '/cancel' || photoCtx.callbackQuery?.data === 'conv:cancel') {
          if (photoCtx.callbackQuery) { try { await photoCtx.answerCallbackQuery(); } catch {} }
          await ctx.reply('Bekor qilindi. ❌');
          return;
        }
        if (photoCtx.message?.photo) {
          const photos = photoCtx.message.photo;
          photoFileId = photos[photos.length - 1].file_id;
          break;
        }
        await ctx.reply('📸 Iltimos, rasm yuboring (majburiy):');
      }

      // Confirmation
      await ctx.reply(
        `📋 <b>YETKAZMA TASDIQLANSIN?</b>\n\n` +
        `${requests.length} ta yetkazma tasdiqlanadi.\n` +
        (note ? `📝 Izoh: ${escapeHtml(note)}\n` : '') +
        `📸 Rasm: Ha`,
        {
          parse_mode: 'HTML',
          reply_markup: buildConfirmationKeyboard('drvdelbatch', { withEdit: false }),
        },
      );

      const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, /^drvdelbatch:(confirm|cancel)/, {
        otherwise: (ctx) => ctx.reply('Iltimos, tasdiqlang yoki bekor qiling.'),
      });
      try { await confirmCtx.answerCallbackQuery(); } catch {}

      if (confirmCtx.callbackQuery!.data === 'drvdelbatch:cancel') {
        await ctx.reply('Bekor qilindi. ❌');
        return;
      }

      // Mark all requests as delivered
      let successCount = 0;
      for (const req of requests) {
        try {
          await conversation.external(() =>
            requestsService.markDelivered(req.id, {
              deliveredQty: req.collectedQty || 0,
              note,
              photoFileId,
            }, user),
          );
          successCount++;
        } catch (err: any) {
          console.error(`[driverDeliverBatch] Error delivering ${req.id}:`, err?.message || err);
        }
      }

      await ctx.reply(`${successCount} ta yetkazma tasdiqlandi! ✅\n\nSkladchi qabul qilishi kerak.`);
    };
  }
}
