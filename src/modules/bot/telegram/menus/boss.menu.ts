import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';

import { VendorAnalyticsService } from 'src/modules/vendor/analytics/vendor-analytics.service';
import { VendorExpensesService } from 'src/modules/vendor/expenses/vendor-expenses.service';
import { VendorWarehousesService } from 'src/modules/vendor/warehouses/vendor-warehouses.service';
import { VendorRequestsService } from 'src/modules/vendor/requests/vendor-requests.service';
import { VendorCashRequestsService } from 'src/modules/vendor/cash-requests/vendor-cash-requests.service';
import { VendorSuppliersService } from 'src/modules/vendor/suppliers/vendor-suppliers.service';
import { RequestStatus, CashRequestStatus } from 'src/common/database/schemas';

import { BotContext } from '../types/context';
import { sessionToUser } from '../helpers/session-to-user';
import { escapeHtml, formatMoney, formatMoneyFull, formatPercent, profitLossEmoji } from '../helpers/format';

@Injectable()
export class BossMenu {
  private readonly logger = new Logger(BossMenu.name);

  constructor(
    private readonly analyticsService: VendorAnalyticsService,
    private readonly expensesService: VendorExpensesService,
    private readonly warehousesService: VendorWarehousesService,
    private readonly requestsService: VendorRequestsService,
    private readonly cashRequestsService: VendorCashRequestsService,
    private readonly suppliersService: VendorSuppliersService,
  ) {}

  async handleDashboard(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const summary = await this.analyticsService.getDashboardSummary(user);
      const profitLoss = await this.analyticsService.getProfitLoss(user);
      const workCompletion = await this.analyticsService.getWorkCompletion(user);
      const warehouseValue = await this.analyticsService.getWarehouseValue(user);

      let text = `📊 <b>STATISTIKA</b>\n`;
      text += `🏗️ ${ctx.session?.selectedProjectName}\n\n`;

      text += `💰 <b>UMUMIY BYUDJET:</b>\n`;
      text += `• ${formatMoneyFull(summary.totalBudget)}\n\n`;

      text += `📥 <b>OLINGAN PUL (KIRIM):</b>\n`;
      text += `• ${formatMoneyFull(summary.totalIncome)}\n\n`;

      text += `📤 <b>QILINGAN RASXOD:</b>\n`;
      text += `• ${formatMoneyFull(summary.totalExpense)}\n\n`;

      text += `🏦 <b>HISOB BALANS:</b>\n`;
      text += `• Bank: ${formatMoneyFull(summary.totalAccountBalance)}\n`;
      text += `• Loyiha koshelogi: ${formatMoneyFull(summary.totalCashRegisterBalance)}\n\n`;

      text += `📐 <b>BAJARILGAN ISH:</b>\n`;
      text += `• Tasdiqlangan: ${formatPercent(workCompletion.overallValidationPercentage)}\n`;
      text += `• Summa: ${formatMoneyFull(workCompletion.totalValidatedAmount)}\n\n`;

      text += `🏬 <b>SKLAD:</b>\n`;
      text += `• Omborlar: ${warehouseValue.totalWarehouses} ta\n`;
      text += `• Mahsulotlar: ${warehouseValue.totalItems} ta\n`;
      if (warehouseValue.warehouses.length > 0) {
        for (const wh of warehouseValue.warehouses) {
          text += `  — ${wh.warehouseName}: ${wh.itemCount} ta, ${wh.totalQuantity} dona\n`;
        }
      }
      text += `\n`;

      // Procurement pipeline
      const pendingReqs = await this.requestsService.findAll(
        { projectId: ctx.session?.selectedProjectId, status: RequestStatus.PENDING, page: 1, limit: 1 },
        user,
      );
      const approvedReqs = await this.requestsService.findAll(
        { projectId: ctx.session?.selectedProjectId, status: RequestStatus.APPROVED, page: 1, limit: 1 },
        user,
      );
      const supplyOrders = await this.suppliersService.findAllSupplyOrders(
        { projectId: ctx.session?.selectedProjectId, page: 1, limit: 100 },
        user,
      );
      const totalOrderCost = supplyOrders.data.reduce((sum, o) => sum + (o.totalCost || 0), 0);

      text += `📦 <b>ZAYAVKALAR:</b>\n`;
      text += `• Kutilayotgan zayavkalar: ${pendingReqs.total} ta\n`;
      text += `• Tasdiqlangan zayavkalar: ${approvedReqs.total} ta\n`;
      text += `• Pastavshik buyurtmalari: ${supplyOrders.total} ta`;
      if (totalOrderCost > 0) {
        text += ` (${formatMoneyFull(totalOrderCost)})`;
      }
      text += `\n\n`;

      const net = profitLoss.netProfitLoss;
      text += `${profitLossEmoji(net)} <b>FOYDA / ZARAR:</b>\n`;
      text += `• ${net >= 0 ? 'Foyda' : 'Zarar'}: ${formatMoneyFull(Math.abs(net))}\n`;
      text += `• Status: ${net >= 0 ? '✅ FOYDA' : '🚨 ZARAR TOMONGA KETAYAPTI'}`;

      const keyboard = new InlineKeyboard()
        .text('💰 Qarzlar', 'boss:debts').row()
        .text('🏬 Sklad', 'boss:warehouse').row()
        .text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Dashboard error', error);
      await ctx.reply('Statistikani yuklashda xatolik yuz berdi.');
    }
  }

  async handleDebts(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const supplierDebts = await this.analyticsService.getSupplierDebts(user);
      const workerDebts = await this.analyticsService.getWorkerDebts(user);

      let text = `💰 <b>QARZLAR</b>\n`;
      text += `🏗️ ${ctx.session?.selectedProjectName}\n\n`;

      text += `🏪 <b>PASTAVSHIKLAR:</b> ${formatMoneyFull(supplierDebts.totalDebt)}\n`;
      if (supplierDebts.suppliers.length > 0) {
        for (const s of supplierDebts.suppliers.slice(0, 10)) {
          text += `  • ${s.supplierName}: ${formatMoneyFull(s.totalDebt)}\n`;
        }
        if (supplierDebts.suppliers.length > 10) {
          text += `  ... va yana ${supplierDebts.suppliers.length - 10} ta\n`;
        }
      } else {
        text += `  Qarz yo'q\n`;
      }

      text += `\n👷 <b>USTALAR:</b> ${formatMoneyFull(workerDebts.totalDebt)}\n`;
      if (workerDebts.workers.length > 0) {
        for (const w of workerDebts.workers.slice(0, 10)) {
          text += `  • ${w.workerName}: ${formatMoneyFull(w.debt)}\n`;
        }
        if (workerDebts.workers.length > 10) {
          text += `  ... va yana ${workerDebts.workers.length - 10} ta\n`;
        }
      } else {
        text += `  Qarz yo'q\n`;
      }

      const keyboard = new InlineKeyboard()
        .text('📊 Statistika', 'boss:dashboard').row()
        .text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Debts error', error);
      await ctx.reply('Qarzlarni yuklashda xatolik yuz berdi.');
    }
  }

  async handleWarehouse(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);

      let text = `🏬 <b>SKLAD</b>\n`;
      text += `🏗️ ${ctx.session?.selectedProjectName}\n\n`;

      if (!ctx.session?.selectedProjectId) {
        text += `Loyiha tanlanmagan.`;
      } else {
        const warehouses = await this.warehousesService.findAllWarehouses(
          { projectId: ctx.session?.selectedProjectId, page: 1, limit: 10 },
          user,
        );

        if (warehouses.data.length === 0) {
          text += `Omborlar topilmadi.`;
        } else {
          for (const wh of warehouses.data) {
            text += `🏬 <b>${wh.name}</b>`;
            if (wh.location) text += ` (${wh.location})`;
            text += `\n`;

            const items = await this.warehousesService.findWarehouseItems(wh.id, user, 1, 20);
            if (items.data.length > 0) {
              for (const item of items.data) {
                text += `  • ${item.name}: ${item.quantity} ${item.unit}\n`;
              }
              if (items.total > 20) {
                text += `  ... va yana ${items.total - 20} ta mahsulot\n`;
              }
            } else {
              text += `  Mahsulotlar yo'q\n`;
            }
            text += `\n`;
          }
        }
      }

      const keyboard = new InlineKeyboard()
        .text('📊 Statistika', 'boss:dashboard').row()
        .text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Warehouse error', error);
      await ctx.reply('Sklad ma\'lumotlarini yuklashda xatolik yuz berdi.');
    }
  }

  async handleExpenseMenu(ctx: BotContext): Promise<void> {
    const text = `💸 <b>RASXODLAR</b>\n🏗️ ${ctx.session?.selectedProjectName}\n\nAmalni tanlang:`;
    const keyboard = new InlineKeyboard()
      .text('➕ Rasxod qo\'shish', 'exp:add').row()
      .text('📋 Rasxod ko\'rish', 'exp:view').row()
      .text('🔙 Menyu', 'main_menu');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  }

  async handleExpenses(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const expenses = await this.expensesService.findAllExpenses(
        { projectId: ctx.session?.selectedProjectId, page: 1, limit: 10 },
        user,
      );

      let text = `💸 <b>RASXODLAR</b>\n`;
      text += `🏗️ ${ctx.session?.selectedProjectName}\n\n`;

      if (expenses.data.length === 0) {
        text += `Rasxodlar topilmadi.`;
      } else {
        for (const exp of expenses.data) {
          text += `• <b>${formatMoney(exp.amount)}</b> so'm`;
          text += ` — ${exp.recipient}`;
          if (exp.category) text += ` (${exp.category})`;
          text += `\n`;
        }
        if (expenses.total > 10) {
          text += `\n... jami ${expenses.total} ta rasxod`;
        }
      }

      const keyboard = new InlineKeyboard()
        .text('➕ Rasxod qo\'shish', 'exp:add').row()
        .text('🔙 Rasxodlar', 'exp:menu').row()
        .text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Expenses error', error);
      await ctx.reply('Rasxodlarni yuklashda xatolik yuz berdi.');
    }
  }

  async handlePending(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const projectId = ctx.session?.selectedProjectId;

      let text = `⏳ <b>KUTILAYOTGAN SO'ROVLAR</b>\n`;
      text += `🏗️ ${ctx.session?.selectedProjectName}\n\n`;

      const keyboard = new InlineKeyboard();

      // Pending material requests
      const pendingRequests = await this.requestsService.findAll(
        { projectId, status: RequestStatus.PENDING, page: 1, limit: 10 },
        user,
      );

      text += `📦 <b>MATERIAL SO'ROVLARI:</b>\n`;
      if (pendingRequests.data.length > 0) {
        for (let i = 0; i < pendingRequests.data.length; i++) {
          const req = pendingRequests.data[i];
          const num = i + 1;
          text += `  <b>#${num}</b> ${escapeHtml(req.smetaItem?.name || 'Noma\'lum')} — ${req.requestedQty} ${escapeHtml(req.smetaItem?.unit || '')}`;
          if (req.requestedAmount) text += ` | ${formatMoneyFull(req.requestedAmount)}`;
          if (req.note) text += `\n  📝 ${escapeHtml(req.note)}`;
          text += `\n`;
          keyboard.text(`✅ #${num}`, `boss:ar:${req.id}`).text(`❌ #${num}`, `boss:rr:${req.id}`).row();
        }
        if (pendingRequests.total > 10) {
          text += `  ... va yana ${pendingRequests.total - 10} ta\n`;
        }
      } else {
        text += `  So'rovlar yo'q ✅\n`;
      }

      // Pending cash requests
      const pendingCash = await this.cashRequestsService.findAll(
        { projectId, status: CashRequestStatus.PENDING, page: 1, limit: 10 },
        user,
      );

      text += `\n💰 <b>PUL ZAYAVKALARI:</b>\n`;
      const reqOffset = pendingRequests.data.length;
      if (pendingCash.data.length > 0) {
        for (let i = 0; i < pendingCash.data.length; i++) {
          const cr = pendingCash.data[i];
          const num = reqOffset + i + 1;
          text += `  <b>#${num}</b> ${formatMoneyFull(cr.amount)}`;
          if (cr.reason) text += ` — ${escapeHtml(cr.reason)}`;
          if (cr.requestedBy?.name) text += `\n  👤 ${escapeHtml(cr.requestedBy.name)}`;
          text += `\n`;
          keyboard.text(`✅ #${num}`, `boss:ac:${cr.id}`).text(`❌ #${num}`, `boss:rc:${cr.id}`).row();
        }
        if (pendingCash.total > 10) {
          text += `  ... va yana ${pendingCash.total - 10} ta\n`;
        }
      } else {
        text += `  Zayavkalar yo'q ✅\n`;
      }

      // Pending expenses (isPaid=false)
      const pendingExpenses = await this.expensesService.findAllExpenses(
        { projectId, isPaid: false, page: 1, limit: 10 },
        user,
      );

      text += `\n💸 <b>RASXODLAR (tasdiqlanmagan):</b>\n`;
      const cashOffset = reqOffset + pendingCash.data.length;
      if (pendingExpenses.data.length > 0) {
        for (let i = 0; i < pendingExpenses.data.length; i++) {
          const exp = pendingExpenses.data[i];
          const num = cashOffset + i + 1;
          text += `  <b>#${num}</b> ${formatMoneyFull(exp.amount)} — ${escapeHtml(exp.recipient)}`;
          if (exp.category) text += ` (${exp.category})`;
          if (exp.note) text += `\n  📝 ${escapeHtml(exp.note)}`;
          if (exp.recordedBy?.name) text += `\n  👤 ${escapeHtml(exp.recordedBy.name)}`;
          text += `\n`;
          keyboard.text(`✅ #${num}`, `boss:ae:${exp.id}`).text(`❌ #${num}`, `boss:re:${exp.id}`).row();
        }
        if (pendingExpenses.total > 10) {
          text += `  ... va yana ${pendingExpenses.total - 10} ta\n`;
        }
      } else {
        text += `  Tasdiqlanmagan rasxodlar yo'q ✅\n`;
      }

      keyboard.text('📊 Statistika', 'boss:dashboard').row();
      keyboard.text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Pending requests error', error);
      await ctx.reply('Kutilayotgan so\'rovlarni yuklashda xatolik yuz berdi.');
    }
  }

  async handleApproveRequest(ctx: BotContext, requestId: string): Promise<void> {
    try {
      const user = sessionToUser(ctx.session, ctx.from!.id);
      await this.requestsService.approve(requestId, user);
      await ctx.reply('Material so\'rovi tasdiqlandi! ✅');
      await this.handlePending(ctx);
    } catch (error) {
      this.logger.error('Approve request error', error);
      await ctx.reply('Tasdiqlashda xatolik yuz berdi. ❌');
    }
  }

  async handleRejectRequest(ctx: BotContext, requestId: string): Promise<void> {
    try {
      const user = sessionToUser(ctx.session, ctx.from!.id);
      await this.requestsService.reject(requestId, {}, user);
      await ctx.reply('Material so\'rovi rad etildi. ❌');
      await this.handlePending(ctx);
    } catch (error) {
      this.logger.error('Reject request error', error);
      await ctx.reply('Rad etishda xatolik yuz berdi. ❌');
    }
  }

  async handleApproveCashRequest(ctx: BotContext, cashRequestId: string): Promise<void> {
    try {
      const user = sessionToUser(ctx.session, ctx.from!.id);
      await this.cashRequestsService.approve(cashRequestId, user);
      await ctx.reply('Pul zayavkasi tasdiqlandi! ✅');
      await this.handlePending(ctx);
    } catch (error) {
      this.logger.error('Approve cash request error', error);
      await ctx.reply('Tasdiqlashda xatolik yuz berdi. ❌');
    }
  }

  async handleRejectCashRequest(ctx: BotContext, cashRequestId: string): Promise<void> {
    try {
      const user = sessionToUser(ctx.session, ctx.from!.id);
      await this.cashRequestsService.reject(cashRequestId, {}, user);
      await ctx.reply('Pul zayavkasi rad etildi. ❌');
      await this.handlePending(ctx);
    } catch (error) {
      this.logger.error('Reject cash request error', error);
      await ctx.reply('Rad etishda xatolik yuz berdi. ❌');
    }
  }

  async handleApproveExpense(ctx: BotContext, expenseId: string): Promise<void> {
    try {
      const user = sessionToUser(ctx.session, ctx.from!.id);
      await this.expensesService.approveExpense(expenseId, user);
      await ctx.reply('Rasxod tasdiqlandi! ✅');
      await this.handlePending(ctx);
    } catch (error) {
      this.logger.error('Approve expense error', error);
      await ctx.reply('Tasdiqlashda xatolik yuz berdi. ❌');
    }
  }

  async handleRejectExpense(ctx: BotContext, expenseId: string): Promise<void> {
    try {
      const user = sessionToUser(ctx.session, ctx.from!.id);
      await this.expensesService.rejectExpense(expenseId, user);
      await ctx.reply('Rasxod rad etildi. ❌');
      await this.handlePending(ctx);
    } catch (error) {
      this.logger.error('Reject expense error', error);
      await ctx.reply('Rad etishda xatolik yuz berdi. ❌');
    }
  }
}
