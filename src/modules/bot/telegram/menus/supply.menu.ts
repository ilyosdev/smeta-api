import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { createConversation } from '@grammyjs/conversations';

import { VendorSuppliersService } from 'src/modules/vendor/suppliers/vendor-suppliers.service';
import { VendorCashRegistersService } from 'src/modules/vendor/cash-registers/vendor-cash-registers.service';
import { VendorExpensesService } from 'src/modules/vendor/expenses/vendor-expenses.service';
import { AiService } from 'src/modules/bot/ai/ai.service';
import { CashTransactionType, PaymentType, ExpenseCategory } from 'src/common/database/schemas';

import { BotContext, BotConversation } from '../types/context';
import { sessionToUser } from '../helpers/session-to-user';
import { formatMoneyFull, escapeHtml } from '../helpers/format';
import { replyCancelWithMenu, waitForCallbackOrCancel } from '../helpers/cancel';
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
  ) {}

  getConversationMiddleware() {
    return [
      createConversation(this.buildOrderConversation(), 'supply_order'),
      createConversation(this.buildPayDebtConversation(), 'supply_pay_debt'),
      createConversation(this.buildDebtHistoryConversation(), 'supply_debt_history'),
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

  async handleNewOrder(ctx: BotContext): Promise<void> {
    if (!ctx.session?.selectedProjectId) {
      await ctx.reply('Avval loyihani tanlang.');
      return;
    }
    await ctx.conversation.enter('supply_order');
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
        // Create supply order (no price — just product + quantity)
        await conversation.external(() =>
          suppliersService.createSupplyOrder(
            {
              supplierId,
              projectId,
              items: [{ name: product, unit, quantity, unitPrice: 0 }],
              note: `${product} ${quantity} ${unit}`,
            },
            user,
          ),
        );

        await ctx.reply('Buyurtma muvaffaqiyatli yaratildi! \u{2705}');
      } catch {
        await ctx.reply('Buyurtmani saqlashda xatolik yuz berdi. \u{274C}');
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
}
