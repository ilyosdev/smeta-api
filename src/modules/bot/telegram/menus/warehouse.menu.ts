import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { createConversation } from '@grammyjs/conversations';

import { VendorWarehousesService } from 'src/modules/vendor/warehouses/vendor-warehouses.service';
import { VendorRequestsService } from 'src/modules/vendor/requests/vendor-requests.service';
import { AiService } from 'src/modules/bot/ai/ai.service';
import { RequestStatus } from 'src/common/database/schemas';

import { BotContext, BotConversation } from '../types/context';
import { sessionToUser } from '../helpers/session-to-user';
import { escapeHtml, parseNumber, formatMoneyFull } from '../helpers/format';
import { buildConfirmationKeyboard } from '../keyboards/confirmation.keyboard';
import { textWithCancel, waitForCallbackOrCancel } from '../helpers/cancel';
import { runSingleMessageFlow } from '../helpers/single-message-flow';
import { WAREHOUSE_ADD_FORM } from '../helpers/form-configs';

@Injectable()
export class WarehouseMenu {
  private readonly logger = new Logger(WarehouseMenu.name);

  constructor(
    private readonly warehousesService: VendorWarehousesService,
    private readonly requestsService: VendorRequestsService,
    private readonly aiService: AiService,
  ) {}

  getConversationMiddleware() {
    return [
      createConversation(this.buildAddItemConversation(), 'wh_add_item'),
      createConversation(this.buildRemoveItemConversation(), 'wh_remove_item'),
      createConversation(this.buildTransferConversation(), 'wh_transfer'),
      createConversation(this.buildReceiveDeliveryConversation(), 'wh_receive_delivery'),
    ];
  }

  async handleAdd(ctx: BotContext): Promise<void> {
    if (!ctx.session?.selectedProjectId) {
      await ctx.reply('Avval loyihani tanlang.');
      return;
    }
    await ctx.conversation.enter('wh_add_item');
  }

  async handleRemove(ctx: BotContext): Promise<void> {
    if (!ctx.session?.selectedProjectId) {
      await ctx.reply('Avval loyihani tanlang.');
      return;
    }
    await ctx.conversation.enter('wh_remove_item');
  }

  async handleTransfer(ctx: BotContext): Promise<void> {
    if (!ctx.session?.selectedProjectId) {
      await ctx.reply('Avval loyihani tanlang.');
      return;
    }
    await ctx.conversation.enter('wh_transfer');
  }

  /**
   * Show pending deliveries (DELIVERED status waiting for warehouse receipt)
   */
  async handlePendingDeliveries(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) {
        await ctx.reply('Avval tizimga kiring: /start');
        return;
      }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const projectId = ctx.session?.selectedProjectId;

      const result = await this.requestsService.findPendingReceipt(projectId, user);

      let text = `🚚 <b>KUTILAYOTGAN YETKAZMALAR</b>\n`;
      text += `🏗️ ${escapeHtml(ctx.session?.selectedProjectName || '')}\n\n`;

      if (result.data.length === 0) {
        text += `Hozircha kutilayotgan yetkazmalar yo'q.`;
      } else {
        for (const req of result.data) {
          text += `📦 <b>${escapeHtml(req.smetaItem?.name || 'Noma\'lum')}</b>\n`;
          text += `   📊 Yetkazilgan: ${req.deliveredQty} ${req.smetaItem?.unit || ''}\n`;
          text += `   💰 Summa: ${formatMoneyFull(req.approvedAmount || req.requestedAmount)}\n`;
          if (req.deliveredAt) {
            text += `   🕐 ${new Date(req.deliveredAt).toLocaleString('uz-UZ')}\n`;
          }
          text += '\n';
        }
      }

      const keyboard = new InlineKeyboard();
      for (const req of result.data.slice(0, 10)) {
        keyboard.text(
          `📦 ${(req.smetaItem?.name || 'Noma\'lum').slice(0, 20)}`,
          `wh:receive:${req.id}`,
        ).row();
      }
      keyboard.text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Pending deliveries error', error);
      await ctx.reply('Yetkazmalarni yuklashda xatolik yuz berdi.');
    }
  }

  /**
   * Start receive delivery conversation
   */
  async handleReceiveDelivery(ctx: BotContext, requestId: string): Promise<void> {
    if (!ctx.session) {
      await ctx.reply('Avval tizimga kiring: /start');
      return;
    }
    ctx.session.pendingReceiveRequestId = requestId;
    await ctx.conversation.enter('wh_receive_delivery');
  }

  async handleInventory(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const warehouses = await this.warehousesService.findAllWarehouses(
        { projectId: ctx.session?.selectedProjectId, page: 1, limit: 10 },
        user,
      );

      let text = `📋 <b>OMBOR</b>\n`;
      text += `🏗️ ${ctx.session?.selectedProjectName}\n\n`;

      if (warehouses.data.length === 0) {
        text += `Omborlar topilmadi.`;
      } else {
        for (const wh of warehouses.data) {
          text += `🏬 <b>${escapeHtml(wh.name)}</b>`;
          if (wh.location) text += ` (${escapeHtml(wh.location)})`;
          text += `\n`;

          const items = await this.warehousesService.findWarehouseItems(wh.id, user, 1, 20);
          if (items.data.length === 0) {
            text += `  <i>Bo'sh</i>\n`;
          } else {
            for (const item of items.data) {
              text += `  • ${escapeHtml(item.name)}: ${item.quantity} ${escapeHtml(item.unit)}\n`;
            }
            if (items.total > 20) {
              text += `  ... va yana ${items.total - 20} ta\n`;
            }
          }
          text += `\n`;
        }
      }

      const keyboard = new InlineKeyboard()
        .text('➕ Mahsulot qo\'shish', 'wh:add').row()
        .text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Inventory error', error);
      await ctx.reply('Ombor ma\'lumotlarini yuklashda xatolik yuz berdi.');
    }
  }

  // --- Conversation builders ---

  private buildAddItemConversation() {
    const warehousesService = this.warehousesService;
    const aiService = this.aiService;

    return async function whAddItem(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const projectId = await conversation.external((ctx) => ctx.session?.selectedProjectId);
      const projectName = await conversation.external((ctx) => ctx.session?.selectedProjectName || '');
      if (!projectId) {
        await ctx.reply('Avval loyihani tanlang: /projects');
        return;
      }

      const user = await conversation.external((ctx) =>
        sessionToUser(ctx.session, ctx.from!.id),
      );

      // Fetch warehouses for this project
      const warehouses = await conversation.external(() =>
        warehousesService.findAllWarehouses({ projectId, page: 1, limit: 20 }, user),
      );

      let warehouseId: string;

      if (warehouses.data.length === 0) {
        // Create a default warehouse
        await ctx.reply(`🏬 Ombor topilmadi. Yangi ombor yaratilmoqda...`);
        const newWh = await conversation.external(() =>
          warehousesService.createWarehouse({ projectId, name: 'Asosiy ombor' }, user),
        );
        warehouseId = newWh.id;
      } else if (warehouses.data.length === 1) {
        warehouseId = warehouses.data[0].id;
      } else {
        const kb = new InlineKeyboard();
        for (const wh of warehouses.data) {
          kb.text(wh.name, `selwh:${wh.id}`).row();
        }
        await ctx.reply('Omborni tanlang:', { reply_markup: kb });
        const whCtx = await waitForCallbackOrCancel(conversation, ctx, /^selwh:/, {
          otherwise: (ctx) => ctx.reply('Iltimos, omborni tanlang.'),
        });
        warehouseId = whCtx.callbackQuery!.data!.split(':')[1];
        try { await whCtx.answerCallbackQuery(); } catch {}
      }

      // Single-message flow for item details
      const result = await runSingleMessageFlow(
        conversation, ctx, WAREHOUSE_ADD_FORM, aiService,
        { projectName },
      );
      if (!result || !result.confirmed) return;

      // Photo confirmation step
      await ctx.reply('\u{1F4F8} Tasdiqlash uchun rasm yuboring:\n\n<i>/cancel - bekor qilish</i>', { parse_mode: 'HTML' });
      for (;;) {
        const photoCtx = await conversation.wait();
        if (photoCtx.message?.text === '/cancel' || photoCtx.callbackQuery?.data === 'conv:cancel') {
          if (photoCtx.callbackQuery) { try { await photoCtx.answerCallbackQuery(); } catch {} }
          await ctx.reply('Bekor qilindi. \u{274C}');
          return;
        }
        if (photoCtx.message?.photo) {
          break; // Photo received — proceed to save
        }
        await ctx.reply('Iltimos, rasm yuboring (yoki /cancel):');
      }

      try {
        await conversation.external(() =>
          warehousesService.createWarehouseItem(
            {
              warehouseId,
              name: result.data.name,
              unit: result.data.unit,
              quantity: result.data.quantity,
            },
            user,
          ),
        );
        await ctx.reply('Mahsulot muvaffaqiyatli qo\'shildi! \u{2705}');
      } catch {
        await ctx.reply('Mahsulotni saqlashda xatolik yuz berdi. \u{274C}');
      }
    };
  }

  private buildRemoveItemConversation() {
    const warehousesService = this.warehousesService;

    return async function whRemoveItem(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const projectId = await conversation.external((ctx) => ctx.session?.selectedProjectId);
      if (!projectId) {
        await ctx.reply('Avval loyihani tanlang: /projects');
        return;
      }

      const user = await conversation.external((ctx) =>
        sessionToUser(ctx.session, ctx.from!.id),
      );

      // Fetch warehouses
      const warehouses = await conversation.external(() =>
        warehousesService.findAllWarehouses({ projectId, page: 1, limit: 20 }, user),
      );

      if (warehouses.data.length === 0) {
        await ctx.reply('Omborlar topilmadi.');
        return;
      }

      let warehouseId: string;
      if (warehouses.data.length === 1) {
        warehouseId = warehouses.data[0].id;
      } else {
        const kb = new InlineKeyboard();
        for (const wh of warehouses.data) {
          kb.text(wh.name, `selwh:${wh.id}`).row();
        }
        await ctx.reply('Omborni tanlang:', { reply_markup: kb });
        const whCtx = await waitForCallbackOrCancel(conversation, ctx, /^selwh:/, {
          otherwise: (ctx) => ctx.reply('Iltimos, omborni tanlang.'),
        });
        warehouseId = whCtx.callbackQuery!.data!.split(':')[1];
        try { await whCtx.answerCallbackQuery(); } catch {}
      }

      // Fetch items in this warehouse
      const items = await conversation.external(() =>
        warehousesService.findWarehouseItems(warehouseId, user, 1, 20),
      );

      if (items.data.length === 0) {
        await ctx.reply('Bu omborida mahsulot yo\'q.');
        return;
      }

      const kb = new InlineKeyboard();
      for (const item of items.data) {
        kb.text(`${item.name} (${item.quantity} ${item.unit})`, `selitem:${item.id}`).row();
      }
      await ctx.reply('Mahsulotni tanlang:', { reply_markup: kb });

      const itemCtx = await waitForCallbackOrCancel(conversation, ctx, /^selitem:/, {
        otherwise: (ctx) => ctx.reply('Iltimos, mahsulotni tanlang.'),
      });
      const itemId = itemCtx.callbackQuery!.data!.split(':')[1];
      const selectedItem = items.data.find((i) => i.id === itemId);
      try { await itemCtx.answerCallbackQuery(); } catch {}

      await ctx.reply(
        `📦 <b>${escapeHtml(selectedItem?.name || '')}</b>\n` +
        `Hozirgi: ${selectedItem?.quantity} ${selectedItem?.unit}\n\n` +
        `Yangi miqdorni kiriting (0 = o'chirish):\n\n<i>/cancel - bekor qilish</i>`,
        { parse_mode: 'HTML' },
      );

      let newQuantity: number;
      for (;;) {
        const raw = await textWithCancel(conversation, ctx);
        newQuantity = parseNumber(raw);
        if (!isNaN(newQuantity) && newQuantity >= 0) break;
        await ctx.reply('Iltimos, to\'g\'ri raqam kiriting (masalan: 500000 yoki 500,000):');
      }

      await ctx.reply('Kimga berildi:');
      const recipient = await textWithCancel(conversation, ctx, {
        otherwise: (ctx) => ctx.reply('Iltimos, matn kiriting:'),
      });

      await ctx.reply('Sabab:');
      const reason = await textWithCancel(conversation, ctx, {
        otherwise: (ctx) => ctx.reply('Iltimos, matn kiriting:'),
      });

      const removedQty = (selectedItem?.quantity || 0) - newQuantity;
      let removeSummary = `✚ <b>SKLAD CHIQIMI</b>\n\n`;
      removeSummary += `🏬 Sklad: ${escapeHtml(warehouses.data.find((w) => w.id === warehouseId)?.name || '')}\n`;
      removeSummary += `📦 Mahsulot: ${escapeHtml(selectedItem?.name || '')}\n`;
      removeSummary += `📊 Miqdor: ${removedQty > 0 ? removedQty : selectedItem?.quantity} ${escapeHtml(selectedItem?.unit || '')}\n`;
      removeSummary += `👤 Kimga: ${escapeHtml(recipient)}\n`;
      removeSummary += `📝 Sabab: ${escapeHtml(reason)}\n`;

      if (newQuantity === 0) {
        removeSummary += `\n⚠️ Mahsulot to'liq o'chiriladi`;
        await ctx.reply(removeSummary, {
          parse_mode: 'HTML',
          reply_markup: buildConfirmationKeyboard('whrem', { withEdit: false }),
        });
      } else {
        removeSummary += `\n📊 Qoldiq: ${newQuantity} ${escapeHtml(selectedItem?.unit || '')}`;
        await ctx.reply(removeSummary, {
          parse_mode: 'HTML',
          reply_markup: buildConfirmationKeyboard('whrem', { withEdit: false }),
        });
      }

      const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, /^whrem:(confirm|cancel)/, {
        otherwise: (ctx) => ctx.reply('Iltimos, tasdiqlang yoki bekor qiling.'),
      });
      try { await confirmCtx.answerCallbackQuery(); } catch {}

      if (confirmCtx.callbackQuery!.data! === 'whrem:cancel') {
        await ctx.reply('Bekor qilindi. \u{274C}');
        return;
      }

      // Photo confirmation step
      await ctx.reply('\u{1F4F8} Chiqimni tasdiqlash uchun rasm yuboring:\n\n<i>/cancel - bekor qilish</i>', { parse_mode: 'HTML' });
      for (;;) {
        const photoCtx = await conversation.wait();
        if (photoCtx.message?.text === '/cancel' || photoCtx.callbackQuery?.data === 'conv:cancel') {
          if (photoCtx.callbackQuery) { try { await photoCtx.answerCallbackQuery(); } catch {} }
          await ctx.reply('Bekor qilindi. \u{274C}');
          return;
        }
        if (photoCtx.message?.photo) {
          break; // Photo received — proceed to update
        }
        await ctx.reply('Iltimos, rasm yuboring (yoki /cancel):');
      }

      try {
        if (newQuantity === 0) {
          await conversation.external(() =>
            warehousesService.removeWarehouseItem(itemId, user),
          );
          await ctx.reply('Mahsulot o\'chirildi! \u{2705}');
        } else {
          await conversation.external(() =>
            warehousesService.updateWarehouseItem(itemId, { quantity: newQuantity }, user),
          );
          await ctx.reply('Miqdor yangilandi! \u{2705}');
        }
      } catch {
        await ctx.reply('Xatolik yuz berdi. \u{274C}');
      }
    };
  }

  private buildTransferConversation() {
    const warehousesService = this.warehousesService;

    return async function whTransfer(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const projectId = await conversation.external((ctx) => ctx.session?.selectedProjectId);
      const projectName = await conversation.external((ctx) => ctx.session?.selectedProjectName || '');
      if (!projectId) {
        await ctx.reply('Avval loyihani tanlang: /projects');
        return;
      }

      const user = await conversation.external((ctx) =>
        sessionToUser(ctx.session, ctx.from!.id),
      );

      const warehouses = await conversation.external(() =>
        warehousesService.findAllWarehouses({ projectId, page: 1, limit: 20 }, user),
      );

      if (warehouses.data.length < 2) {
        await ctx.reply('Ko\'chirish uchun kamida 2 ta ombor kerak.');
        return;
      }

      // Select source warehouse
      const fromKb = new InlineKeyboard();
      for (const wh of warehouses.data) {
        fromKb.text(wh.name, `selfrom:${wh.id}`).row();
      }
      await ctx.reply(
        `🔄 <b>KO'CHIRISH</b>\n🏗️ ${projectName}\n\nQaysi ombordan:\n\n<i>/cancel - bekor qilish</i>`,
        { parse_mode: 'HTML', reply_markup: fromKb },
      );
      const fromCtx = await waitForCallbackOrCancel(conversation, ctx, /^selfrom:/, {
        otherwise: (ctx) => ctx.reply('Iltimos, omborni tanlang.'),
      });
      const fromWarehouseId = fromCtx.callbackQuery!.data!.split(':')[1];
      const fromName = warehouses.data.find((w) => w.id === fromWarehouseId)?.name || '';
      try { await fromCtx.answerCallbackQuery(); } catch {}

      // Select destination warehouse (exclude source)
      const toKb = new InlineKeyboard();
      for (const wh of warehouses.data) {
        if (wh.id !== fromWarehouseId) {
          toKb.text(wh.name, `selto:${wh.id}`).row();
        }
      }
      await ctx.reply('Qaysi omborga:', { reply_markup: toKb });
      const toCtx = await waitForCallbackOrCancel(conversation, ctx, /^selto:/, {
        otherwise: (ctx) => ctx.reply('Iltimos, omborni tanlang.'),
      });
      const toWarehouseId = toCtx.callbackQuery!.data!.split(':')[1];
      const toName = warehouses.data.find((w) => w.id === toWarehouseId)?.name || '';
      try { await toCtx.answerCallbackQuery(); } catch {}

      await ctx.reply('Mahsulot nomini kiriting:');
      const itemName = await textWithCancel(conversation, ctx, {
        otherwise: (ctx) => ctx.reply('Iltimos, matn kiriting:'),
      });

      await ctx.reply('O\'lchov birligini kiriting:');
      const unit = await textWithCancel(conversation, ctx, {
        otherwise: (ctx) => ctx.reply('Iltimos, matn kiriting:'),
      });

      await ctx.reply('Miqdorni kiriting:');
      let quantity: number;
      for (;;) {
        const raw = await textWithCancel(conversation, ctx);
        quantity = parseNumber(raw);
        if (!isNaN(quantity) && quantity > 0) break;
        await ctx.reply('Iltimos, to\'g\'ri raqam kiriting (masalan: 500000 yoki 500,000):');
      }

      const summary =
        `📋 <b>KO'CHIRISH TASDIQLANSIN?</b>\n\n` +
        `📤 Dan: ${escapeHtml(fromName)}\n` +
        `📥 Ga: ${escapeHtml(toName)}\n` +
        `📦 Mahsulot: ${escapeHtml(itemName)}\n` +
        `📏 Birlik: ${escapeHtml(unit)}\n` +
        `🔢 Miqdor: ${quantity}\n`;

      await ctx.reply(summary, {
        parse_mode: 'HTML',
        reply_markup: buildConfirmationKeyboard('whtransfer', { withEdit: false }),
      });

      const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, /^whtransfer:(confirm|cancel)/, {
        otherwise: (ctx) => ctx.reply('Iltimos, tasdiqlang yoki bekor qiling.'),
      });
      try { await confirmCtx.answerCallbackQuery(); } catch {}

      if (confirmCtx.callbackQuery!.data! === 'whtransfer:cancel') {
        await ctx.reply('Bekor qilindi. ❌');
        return;
      }

      try {
        const transfer = await conversation.external(() =>
          warehousesService.createTransfer(
            { fromWarehouseId, toWarehouseId, itemName, unit, quantity },
            user,
          ),
        );
        // Auto-complete the transfer
        await conversation.external(() =>
          warehousesService.completeTransfer(transfer.id, user),
        );
        await ctx.reply('Ko\'chirish muvaffaqiyatli amalga oshirildi! ✅');
      } catch {
        await ctx.reply('Ko\'chirishda xatolik yuz berdi. ❌');
      }
    };
  }

  private buildReceiveDeliveryConversation() {
    const requestsService = this.requestsService;
    const warehousesService = this.warehousesService;

    return async function whReceiveDelivery(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const requestId = await conversation.external((ctx) => ctx.session?.pendingReceiveRequestId);
      const projectId = await conversation.external((ctx) => ctx.session?.selectedProjectId);
      if (!requestId) {
        await ctx.reply('Yetkazma topilmadi. Qaytadan urinib ko\'ring.');
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
        await ctx.reply('Yetkazma topilmadi. ❌');
        return;
      }

      if (request.status !== RequestStatus.DELIVERED) {
        await ctx.reply('Bu yetkazma allaqachon qabul qilingan yoki bekor qilingan. ❌');
        return;
      }

      // Show delivery details
      await ctx.reply(
        `📦 <b>YETKAZMA QABUL QILISH</b>\n\n` +
        `📦 ${escapeHtml(request.smetaItem?.name || 'Noma\'lum')}\n` +
        `📊 Yetkazilgan: ${request.deliveredQty} ${request.smetaItem?.unit || ''}\n` +
        `💰 Summa: ${formatMoneyFull(request.approvedAmount || request.requestedAmount)}\n\n` +
        `Qabul qilingan miqdorni kiriting:\n\n<i>/cancel - bekor qilish</i>`,
        { parse_mode: 'HTML' },
      );

      let receivedQty: number;
      for (;;) {
        const raw = await textWithCancel(conversation, ctx);
        receivedQty = parseNumber(raw);
        if (!isNaN(receivedQty) && receivedQty >= 0) break;
        await ctx.reply('Iltimos, to\'g\'ri raqam kiriting (masalan: 500 yoki 500,000):');
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
      let summary = `📋 <b>QABUL TASDIQLANSIN?</b>\n\n`;
      summary += `📦 ${escapeHtml(request.smetaItem?.name || '')}\n`;
      summary += `📊 Qabul qilingan: ${receivedQty} ${request.smetaItem?.unit || ''}\n`;
      if (note) summary += `📝 Izoh: ${escapeHtml(note)}\n`;
      if (photoFileId) summary += `📸 Rasm: Ha\n`;

      await ctx.reply(summary, {
        parse_mode: 'HTML',
        reply_markup: buildConfirmationKeyboard('whrec', { withEdit: false }),
      });

      const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, /^whrec:(confirm|cancel)/, {
        otherwise: (ctx) => ctx.reply('Iltimos, tasdiqlang yoki bekor qiling.'),
      });
      try { await confirmCtx.answerCallbackQuery(); } catch {}

      if (confirmCtx.callbackQuery!.data === 'whrec:cancel') {
        await ctx.reply('Bekor qilindi. ❌');
        return;
      }

      try {
        // Confirm receipt in request (goes to RECEIVED status, waiting for MODERATOR)
        await conversation.external(() =>
          requestsService.confirmReceipt(requestId, {
            receivedQty,
            note,
            photoFileId,
          }, user),
        );

        await ctx.reply('Yetkazma qabul qilindi! ✅\n\nModerator narxlarni kiritishi kerak.');
      } catch (err: any) {
        console.error('[whReceiveDelivery] error:', err?.message || err);
        await ctx.reply('Qabul qilishda xatolik yuz berdi. ❌');
      }
    };
  }
}
