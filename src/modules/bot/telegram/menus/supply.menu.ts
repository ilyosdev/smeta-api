import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { createConversation } from '@grammyjs/conversations';

import { VendorSuppliersService } from 'src/modules/vendor/suppliers/vendor-suppliers.service';
import { VendorCashRegistersService } from 'src/modules/vendor/cash-registers/vendor-cash-registers.service';
import { VendorExpensesService } from 'src/modules/vendor/expenses/vendor-expenses.service';
import { VendorRequestsService } from 'src/modules/vendor/requests/vendor-requests.service';
import { AiService } from 'src/modules/bot/ai/ai.service';
import { CashTransactionType, PaymentType, ExpenseCategory, RequestStatus } from 'src/common/database/schemas';
import { buildConfirmationKeyboard } from '../keyboards/confirmation.keyboard';
import { parseNumber } from '../helpers/format';

import { BotContext, BotConversation } from '../types/context';
import { sessionToUser } from '../helpers/session-to-user';
import { formatMoneyFull, escapeHtml } from '../helpers/format';
import { replyCancelWithMenu, waitForCallbackOrCancel, textWithCancel } from '../helpers/cancel';
import { runSingleMessageFlow } from '../helpers/single-message-flow';
import { SUPPLY_ORDER_FORM } from '../helpers/form-configs';
import { searchAndSelectEntity } from '../helpers/name-search';

@Injectable()
export class SupplyMenu {
  private readonly logger = new Logger(SupplyMenu.name);

  constructor(
    private readonly suppliersService: VendorSuppliersService,
    private readonly cashRegistersService: VendorCashRegistersService,
    private readonly aiService: AiService,
    private readonly expensesService: VendorExpensesService,
    private readonly requestsService: VendorRequestsService,
  ) {}

  getConversationMiddleware() {
    return [
      createConversation(this.buildOrderConversation(), 'supply_order'),
      createConversation(this.buildPayDebtConversation(), 'supply_pay_debt'),
      createConversation(this.buildDebtHistoryConversation(), 'supply_debt_history'),
      createConversation(this.buildApproveRequestConversation(), 'supply_approve_request'),
    ];
  }

  async handleDebtMenu(ctx: BotContext): Promise<void> {
    const text = `\u{1F4B0} <b>QARZ TO'LASH</b>\n\u{1F3D7}\u{FE0F} ${ctx.session?.selectedProjectName}\n\nAmalni tanlang:`;
    const keyboard = new InlineKeyboard()
      .text('\u{1F4B0} Qarz to\'lash', 'supply:pay_debt').row()
      .text('\u{1F4CB} Qarz tarixi', 'supply:debt_history').row()
      .text('\u{1F4B8} Berilgan pullar', 'supply:payments').row()
      .text('\u{1F519} Menyu', 'main_menu');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  }

  async handleOrdersMenu(ctx: BotContext): Promise<void> {
    const projectName = ctx.session?.selectedProjectName || '';
    const text = `📦 <b>BUYURTMALAR</b>\n🏗️ ${escapeHtml(projectName)}`;

    const keyboard = new InlineKeyboard()
      .text('📋 Zayavkalar (Prorabdan)', 'supply:requests').row()
      .text('➕ Yangi buyurtma', 'supply:new_order').row()
      .text('📜 Buyurtmalar tarixi', 'supply:orders').row()
      .text('🔙 Menyu', 'main_menu');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  }

  async handleNewOrder(ctx: BotContext): Promise<void> {
    if (!ctx.session?.selectedProjectId) {
      await ctx.reply('Avval loyihani tanlang.');
      return;
    }
    await ctx.conversation.enter('supply_order');
  }

  async handleRequests(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) {
        await ctx.reply('Avval tizimga kiring: /start');
        return;
      }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const projectId = ctx.session?.selectedProjectId;

      // Fetch pending requests from Prorab
      const result = await this.requestsService.findAll(
        { projectId, status: RequestStatus.PENDING, page: 1, limit: 20 },
        user,
      );

      let text = `📋 <b>ZAYAVKALAR (Prorablardan)</b>\n🏗️ ${escapeHtml(ctx.session?.selectedProjectName || '')}\n\n`;

      if (result.data.length === 0) {
        text += `Zayavkalar yo'q.`;
      } else {
        for (let i = 0; i < result.data.length; i++) {
          const req = result.data[i];
          const statusIcon = req.status === 'PENDING' ? '🟡' : req.status === 'APPROVED' ? '✅' : '❌';
          text += `${statusIcon} <b>${escapeHtml(req.smetaItem?.name || 'Noma\'lum')}</b>\n`;
          text += `   📦 Miqdor: ${req.requestedQty} ${req.smetaItem?.unit || ''}\n`;
          if (req.requestedBy?.name) {
            text += `   👷 ${escapeHtml(req.requestedBy.name)}\n`;
          }
          if (req.note) {
            text += `   📝 ${escapeHtml(req.note)}\n`;
          }
          text += `   📅 ${new Date(req.createdAt).toLocaleDateString('uz-UZ')}\n\n`;
        }
        if (result.total > 20) {
          text += `... jami ${result.total} ta zayavka`;
        }
      }

      const keyboard = new InlineKeyboard();
      // Add approve buttons for each pending request
      for (const req of result.data.slice(0, 10)) {
        keyboard.text(
          `✅ ${(req.smetaItem?.name || 'Noma\'lum').slice(0, 20)}`,
          `supply:approve:${req.id}`,
        ).row();
      }
      keyboard.text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Requests list error', error);
      await ctx.reply('Zayavkalarni yuklashda xatolik yuz berdi.');
    }
  }

  /**
   * Start approve request conversation
   */
  async handleApproveRequest(ctx: BotContext, requestId: string): Promise<void> {
    if (!ctx.session) {
      await ctx.reply('Avval tizimga kiring: /start');
      return;
    }
    ctx.session.pendingApproveRequestId = requestId;
    await ctx.conversation.enter('supply_approve_request');
  }

  async handleOrders(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) {
        await ctx.reply('Avval tizimga kiring: /start');
        return;
      }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const projectId = ctx.session?.selectedProjectId;

      // Fetch orders for current project
      const result = await this.suppliersService.findAllSupplyOrders(
        { projectId, page: 1, limit: 20 },
        user,
      );

      let text = `📋 <b>BUYURTMALAR</b>\n🏗️ ${escapeHtml(ctx.session?.selectedProjectName || '')}\n\n`;

      if (result.data.length === 0) {
        text += `Buyurtmalar yo'q.`;
      } else {
        for (const order of result.data) {
          const statusIcon = order.status === 'ORDERED' ? '🟡' : order.status === 'DELIVERED' ? '✅' : order.status === 'PARTIAL' ? '🟠' : '❌';
          text += `${statusIcon} <b>${escapeHtml(order.supplier?.name || 'Noma\'lum')}</b>\n`;
          if (order.items && order.items.length > 0) {
            for (const item of order.items) {
              text += `   • ${escapeHtml(item.name)} - ${item.quantity} ${item.unit}`;
              if (item.unitPrice > 0) {
                text += ` (${formatMoneyFull(item.totalCost)})`;
              }
              text += '\n';
            }
          }
          if (order.note) {
            text += `   📝 ${escapeHtml(order.note)}\n`;
          }
          text += `   📅 ${new Date(order.createdAt).toLocaleDateString('uz-UZ')}\n\n`;
        }
        if (result.total > 20) {
          text += `... jami ${result.total} ta buyurtma`;
        }
      }

      const keyboard = new InlineKeyboard()
        .text('📦 Yangi buyurtma', 'supply:new_order').row()
        .text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Orders list error', error);
      await ctx.reply('Buyurtmalarni yuklashda xatolik yuz berdi.');
    }
  }

  async handlePayDebt(ctx: BotContext): Promise<void> {
    if (!ctx.session?.selectedProjectId) {
      await ctx.reply('Avval loyihani tanlang.');
      return;
    }
    await ctx.conversation.enter('supply_pay_debt');
  }

  async handleDebtHistory(ctx: BotContext): Promise<void> {
    if (!ctx.session?.selectedProjectId) {
      await ctx.reply('Avval loyihani tanlang.');
      return;
    }
    await ctx.conversation.enter('supply_debt_history');
  }

  async handlePayments(ctx: BotContext): Promise<void> {
    const text = `\u{1F4B8} <b>BERILGAN PULLAR</b>\n\u{1F3D7}\u{FE0F} ${ctx.session?.selectedProjectName}\n\nDavrni tanlang:`;
    const keyboard = new InlineKeyboard()
      .text('\u{1F4C5} Oxirgi hafta', 'supply:pay:week').row()
      .text('\u{1F4C5} Oxirgi oy', 'supply:pay:month').row()
      .text('\u{1F519} Menyu', 'main_menu');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  }

  async handlePaymentsFiltered(ctx: BotContext, dateFrom: Date, dateTo: Date): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);

      const result = await this.suppliersService.findPaidDebts(user, { dateFrom, dateTo, page: 1, limit: 20 });

      let text = `\u{1F4B8} <b>BERILGAN PULLAR</b>\n\u{1F3D7}\u{FE0F} ${ctx.session?.selectedProjectName}\n\n`;

      if (result.data.length === 0) {
        text += `Bu davrda to'lovlar yo'q.`;
      } else {
        let total = 0;
        for (const d of result.data) {
          text += `\u{1F4B5} <b>${formatMoneyFull(d.amount)}</b>`;
          if (d.supplier?.name) text += ` \u{2014} ${escapeHtml(d.supplier.name)}`;
          if (d.reason) text += `\n  ${escapeHtml(d.reason)}`;
          if (d.paidAt) text += `\n  \u{1F4C5} ${new Date(d.paidAt).toLocaleDateString('uz-UZ')}`;
          text += `\n\n`;
          total += d.amount;
        }
        text += `\u{1F4B0} <b>Jami:</b> ${formatMoneyFull(total)}`;
        if (result.total > 20) {
          text += `\n... jami ${result.total} ta`;
        }
      }

      const keyboard = new InlineKeyboard()
        .text('\u{1F519} Orqaga', 'supply:payments').row()
        .text('\u{1F519} Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Payments filtered error', error);
      await ctx.reply('Ma\'lumotlarni yuklashda xatolik yuz berdi.');
    }
  }

  // --- Conversation builders ---

  private buildOrderConversation() {
    const suppliersService = this.suppliersService;
    const aiService = this.aiService;

    return async function supplyOrder(
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

      // Single-message flow: supplier name + product + quantity + unit
      const result = await runSingleMessageFlow(
        conversation, ctx, SUPPLY_ORDER_FORM, aiService,
        { projectName },
      );
      if (!result || !result.confirmed) return;

      const supplierName: string = result.data.supplierName;
      const product: string = result.data.product;
      const quantity: number = result.data.quantity || 1;
      const unit: string = result.data.unit || 'dona';
      const summa: number = result.data.summa || 0;

      // Find or create supplier
      let supplierId: string;
      const suppliers = await conversation.external(() =>
        suppliersService.findAllSuppliers({ search: supplierName }, user),
      );

      if (suppliers.data.length === 0) {
        // Auto-create
        const newSupplier = await conversation.external(() =>
          suppliersService.createSupplier({ name: supplierName }, user),
        );
        supplierId = newSupplier.id;
      } else if (suppliers.data.length === 1) {
        supplierId = suppliers.data[0].id;
      } else {
        // Multiple matches — let user pick
        const kb = new InlineKeyboard();
        for (const s of suppliers.data.slice(0, 10)) {
          kb.text(s.name, `selsup:${s.id}`).row();
        }
        kb.text('\u{2795} Yangi: ' + supplierName, 'selsup:new');
        await ctx.reply('Qaysi postavshik?', { reply_markup: kb });
        const supCtx = await waitForCallbackOrCancel(conversation, ctx, /^selsup:/);
        try { await supCtx.answerCallbackQuery(); } catch {}
        const selected = supCtx.callbackQuery!.data!.split(':')[1];
        if (selected === 'new') {
          const newSup = await conversation.external(() =>
            suppliersService.createSupplier({ name: supplierName }, user),
          );
          supplierId = newSup.id;
        } else {
          supplierId = selected;
        }
      }

      try {
        // Create supply order with price
        const unitPrice = quantity > 0 ? summa / quantity : summa;
        const order = await conversation.external(() =>
          suppliersService.createSupplyOrder(
            {
              supplierId,
              projectId,
              items: [{ name: product, unit, quantity, unitPrice }],
              note: `${product} ${quantity} ${unit}`,
            },
            user,
          ),
        );

        // Create debt for this order
        if (summa > 0) {
          await conversation.external(() =>
            suppliersService.createSupplierDebt(
              {
                supplierId,
                amount: summa,
                reason: `${product} ${quantity} ${unit}`,
                orderId: order.id,
              },
              user,
            ),
          );
        }

        await ctx.reply('Buyurtma muvaffaqiyatli yaratildi! ✅\nQarzga qo\'shildi: ' + formatMoneyFull(summa));
      } catch {
        await ctx.reply('Buyurtmani saqlashda xatolik yuz berdi. ❌');
      }
    };
  }

  private buildPayDebtConversation() {
    const suppliersService = this.suppliersService;
    const cashRegistersService = this.cashRegistersService;
    const expensesService = this.expensesService;
    const aiService = this.aiService;

    return async function supplyPayDebt(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const projectId = await conversation.external((ctx) => ctx.session?.selectedProjectId);
      const projectName = await conversation.external((ctx) => ctx.session?.selectedProjectName || '');
      if (!projectId) { await ctx.reply('Avval loyihani tanlang: /projects'); return; }

      const user = await conversation.external((ctx) =>
        sessionToUser(ctx.session, ctx.from!.id),
      );

      // Step 1: Search and select supplier
      const supplier = await searchAndSelectEntity(conversation, ctx, {
        prompt: '\u{1F4B0} <b>QARZ TO\'LASH</b>\n\u{1F3D7}\u{FE0F} ' + escapeHtml(projectName) + '\n\nPostavshik nomini kiriting (matn yoki ovozli xabar):',
        searchFn: async (name) => {
          const result = await suppliersService.findAllSuppliers({ search: name }, user);
          return result.data.filter((s) => s.totalDebt && s.totalDebt > 0);
        },
        getLabel: (s) => `${s.name} (${formatMoneyFull(s.totalDebt || 0)})`,
        getId: (s) => s.id,
        notFoundMessage: 'Bunday postavshik topilmadi yoki qarz yo\'q.',
        callbackPrefix: 'selpaysup',
        aiService,
      });

      if (!supplier) return;

      // Step 2: Fetch unpaid debts
      const debts = await conversation.external(() =>
        suppliersService.findSupplierDebtsByFilter(user, { supplierId: supplier.id, isPaid: false }),
      );

      if (debts.data.length === 0) {
        await ctx.reply(`Bu postavshikda qarz yo'q \u{2705}`);
        return;
      }

      // Show debts
      let debtText = `\u{1F4B0} <b>${escapeHtml(supplier.name)}</b> qarzlari:\n\n`;
      const kb = new InlineKeyboard();
      for (const d of debts.data.slice(0, 10)) {
        const label = `${formatMoneyFull(d.amount)}${d.reason ? ' \u{2014} ' + d.reason.slice(0, 20) : ''}`;
        debtText += `\u{23F3} ${formatMoneyFull(d.amount)}`;
        if (d.reason) debtText += ` \u{2014} ${escapeHtml(d.reason)}`;
        if (d.createdAt) debtText += ` (\u{1F4C5} ${new Date(d.createdAt).toLocaleDateString('uz-UZ')})`;
        debtText += '\n';
        kb.text(label, `paydbt:${d.id}`).row();
      }
      kb.text('\u{274C} Bekor qilish', 'conv:cancel');

      await ctx.reply(debtText + '\nQaysi qarzni to\'laysiz?', {
        parse_mode: 'HTML',
        reply_markup: kb,
      });

      // Step 3: Wait for debt selection
      const debtCtx = await waitForCallbackOrCancel(conversation, ctx, /^paydbt:/, {
        otherwise: (c) => c.reply('Iltimos, qarzni tanlang.'),
      });
      try { await debtCtx.answerCallbackQuery(); } catch {}
      const debtId = debtCtx.callbackQuery!.data!.split(':')[1];
      const selectedDebt = debts.data.find((d) => d.id === debtId);
      if (!selectedDebt) {
        await ctx.reply('Qarz topilmadi. \u{274C}');
        return;
      }

      // Step 4: Execute payment
      try {
        // Get/create cash register
        const registers = await conversation.external(() =>
          cashRegistersService.findAllCashRegisters({}, user),
        );
        let cashRegisterId: string;
        if (registers.data.length === 0) {
          const newReg = await conversation.external(() =>
            cashRegistersService.createCashRegister({}, user),
          );
          cashRegisterId = newReg.id;
        } else {
          cashRegisterId = registers.data[0].id;
        }

        // Cash OUT transaction
        await conversation.external(() =>
          cashRegistersService.createCashTransaction(
            {
              cashRegisterId,
              type: CashTransactionType.OUT,
              amount: selectedDebt.amount,
              note: `Qarz to'lash \u{2014} ${supplier.name} | ${selectedDebt.reason || ''}`,
            },
            user,
          ),
        );

        // Create expense record
        await conversation.external(() =>
          expensesService.createExpense(
            {
              projectId,
              amount: selectedDebt.amount,
              recipient: supplier.name,
              category: ExpenseCategory.MATERIAL,
              paymentType: PaymentType.CASH,
              note: selectedDebt.reason || undefined,
              isPaid: true,
            },
            user,
          ),
        );

        // Mark debt as paid
        await conversation.external(() =>
          suppliersService.paySupplierDebt(debtId, user),
        );

        await ctx.reply(
          `Qarz to'landi! \u{2705} Koshelokdan ${formatMoneyFull(selectedDebt.amount)} yechildi.`,
          { parse_mode: 'HTML' },
        );
      } catch (err: any) {
        console.error('[supplyPayDebt] error:', err?.message || err);
        await ctx.reply('Qarz to\'lashda xatolik yuz berdi. \u{274C}');
      }
    };
  }

  private buildDebtHistoryConversation() {
    const suppliersService = this.suppliersService;
    const aiService = this.aiService;

    return async function supplyDebtHistory(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const projectName = await conversation.external((ctx) => ctx.session?.selectedProjectName || '');

      const user = await conversation.external((ctx) =>
        sessionToUser(ctx.session, ctx.from!.id),
      );

      // Search and select supplier
      const supplier = await searchAndSelectEntity(conversation, ctx, {
        prompt: '\u{1F4CB} <b>QARZ TARIXI</b>\n\u{1F3D7}\u{FE0F} ' + escapeHtml(projectName) + '\n\nPostavshik nomini kiriting:',
        searchFn: async (name) => {
          const result = await suppliersService.findAllSuppliers({ search: name }, user);
          return result.data;
        },
        getLabel: (s) => `${s.name}${s.totalDebt ? ' (' + formatMoneyFull(s.totalDebt) + ')' : ''}`,
        getId: (s) => s.id,
        notFoundMessage: 'Bunday postavshik topilmadi.',
        callbackPrefix: 'selhist',
        aiService,
      });

      if (!supplier) return;

      // Fetch all debts for this supplier
      const debts = await conversation.external(() =>
        suppliersService.findSupplierDebtsByFilter(user, { supplierId: supplier.id }),
      );

      let text = `\u{1F4CB} <b>${escapeHtml(supplier.name)} \u{2014} Qarz tarixi</b>\n\n`;

      if (debts.data.length === 0) {
        text += `Qarzlar yo'q.`;
      } else {
        let totalUnpaid = 0;
        let totalPaid = 0;
        for (const d of debts.data) {
          const icon = d.isPaid ? '\u{2705}' : '\u{23F3}';
          text += `${icon} ${formatMoneyFull(d.amount)}`;
          if (d.reason) text += ` \u{2014} ${escapeHtml(d.reason)}`;
          text += `\n  \u{1F4C5} ${new Date(d.createdAt).toLocaleDateString('uz-UZ')}`;
          if (d.isPaid && d.paidAt) {
            text += ` \u{2192} To'langan: ${new Date(d.paidAt).toLocaleDateString('uz-UZ')}`;
            totalPaid += d.amount;
          } else {
            totalUnpaid += d.amount;
          }
          text += '\n\n';
        }
        text += `\u{23F3} To'lanmagan: <b>${formatMoneyFull(totalUnpaid)}</b>\n`;
        text += `\u{2705} To'langan: <b>${formatMoneyFull(totalPaid)}</b>`;
      }

      const keyboard = new InlineKeyboard()
        .text('\u{1F519} Menyu', 'main_menu');

      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    };
  }

  private buildApproveRequestConversation() {
    const requestsService = this.requestsService;

    return async function supplyApproveRequest(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const requestId = await conversation.external((ctx) => ctx.session?.pendingApproveRequestId);
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

      if (request.status !== RequestStatus.PENDING) {
        await ctx.reply('Bu zayavka allaqachon tasdiqlangan yoki bekor qilingan. ❌');
        return;
      }

      // Show request details
      await ctx.reply(
        `✅ <b>ZAYAVKANI TASDIQLASH</b>\n\n` +
        `📦 ${escapeHtml(request.smetaItem?.name || 'Noma\'lum')}\n` +
        `📊 So'ralgan miqdor: ${request.requestedQty} ${request.smetaItem?.unit || ''}\n` +
        `💰 Smeta narxi: ${formatMoneyFull(request.requestedAmount)}\n` +
        `👷 Prorab: ${escapeHtml(request.requestedBy?.name || '')}\n\n` +
        `Tasdiqlangan miqdorni kiriting:\n\n<i>/cancel - bekor qilish</i>`,
        { parse_mode: 'HTML' },
      );

      // Get approved quantity
      let approvedQty: number;
      for (;;) {
        const raw = await textWithCancel(conversation, ctx);
        approvedQty = parseNumber(raw);
        if (!isNaN(approvedQty) && approvedQty >= 0) break;
        await ctx.reply('Iltimos, to\'g\'ri raqam kiriting (masalan: 500 yoki 500,000):');
      }

      // Get price (narx)
      await ctx.reply('Narxni kiriting (jami summa):\n\n<i>/cancel - bekor qilish</i>', { parse_mode: 'HTML' });
      let approvedAmount: number;
      for (;;) {
        const raw = await textWithCancel(conversation, ctx);
        approvedAmount = parseNumber(raw);
        if (!isNaN(approvedAmount) && approvedAmount >= 0) break;
        await ctx.reply('Iltimos, to\'g\'ri raqam kiriting (masalan: 5000000 yoki 5,000,000):');
      }

      // Get available drivers
      const drivers = await conversation.external(() =>
        requestsService.getAvailableDrivers(user),
      );

      if (drivers.length === 0) {
        await ctx.reply('Haydovchilar topilmadi. Avval haydovchi qo\'shing. ❌');
        return;
      }

      // Select driver
      const driverKb = new InlineKeyboard();
      for (const driver of drivers.slice(0, 10)) {
        driverKb.text(`🚚 ${driver.name}`, `seldrv:${driver.id}`).row();
      }
      driverKb.text('❌ Bekor qilish', 'conv:cancel');

      await ctx.reply('Haydovchini tanlang:', { reply_markup: driverKb });

      const driverCtx = await waitForCallbackOrCancel(conversation, ctx, /^seldrv:/, {
        otherwise: (ctx) => ctx.reply('Iltimos, haydovchini tanlang.'),
      });
      try { await driverCtx.answerCallbackQuery(); } catch {}
      const driverId = driverCtx.callbackQuery!.data!.split(':')[1];
      const selectedDriver = drivers.find((d) => d.id === driverId);

      // Show confirmation
      let summary = `📋 <b>TASDIQLASH</b>\n\n`;
      summary += `📦 ${escapeHtml(request.smetaItem?.name || '')}\n`;
      summary += `📊 Tasdiqlangan miqdor: ${approvedQty} ${request.smetaItem?.unit || ''}\n`;
      summary += `💰 Narx: ${formatMoneyFull(approvedAmount)}\n`;
      summary += `🚚 Haydovchi: ${escapeHtml(selectedDriver?.name || '')}\n`;

      await ctx.reply(summary, {
        parse_mode: 'HTML',
        reply_markup: buildConfirmationKeyboard('supapp', { withEdit: false }),
      });

      const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, /^supapp:(confirm|cancel)/, {
        otherwise: (ctx) => ctx.reply('Iltimos, tasdiqlang yoki bekor qiling.'),
      });
      try { await confirmCtx.answerCallbackQuery(); } catch {}

      if (confirmCtx.callbackQuery!.data === 'supapp:cancel') {
        await ctx.reply('Bekor qilindi. ❌');
        return;
      }

      try {
        await conversation.external(() =>
          requestsService.approveAndAssign(requestId, {
            approvedQty,
            approvedAmount,
            driverId,
          }, user),
        );
        await ctx.reply(
          `Zayavka tasdiqlandi! ✅\n\n` +
          `🚚 ${escapeHtml(selectedDriver?.name || '')} ga tayinlandi.`,
        );
      } catch (err: any) {
        console.error('[supplyApproveRequest] error:', err?.message || err);
        await ctx.reply('Tasdiqlashda xatolik yuz berdi. ❌');
      }
    };
  }
}
