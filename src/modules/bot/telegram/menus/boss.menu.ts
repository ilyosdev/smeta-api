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

  async handleDebts(ctx: BotContext, index?: number): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const supplierDebts = await this.analyticsService.getSupplierDebts(user);
      const workerDebts = await this.analyticsService.getWorkerDebts(user);

      // Combine all debts into one list
      type DebtItem = { type: 'supplier' | 'worker'; name: string; amount: number; id: string };
      const allDebts: DebtItem[] = [];
      for (const s of supplierDebts.suppliers) {
        if (s.totalDebt > 0) {
          allDebts.push({ type: 'supplier', name: s.supplierName, amount: s.totalDebt, id: `s_${s.supplierId}` });
        }
      }
      for (const w of workerDebts.workers) {
        if (w.debt > 0) {
          allDebts.push({ type: 'worker', name: w.workerName, amount: w.debt, id: `w_${w.workerId}` });
        }
      }

      // Cache IDs for navigation
      ctx.session.bossDebtIds = allDebts.map((d) => d.id);

      let text = `💰 <b>QARZLAR</b>\n`;
      text += `🏗️ ${ctx.session?.selectedProjectName}\n\n`;

      const totalDebt = supplierDebts.totalDebt + workerDebts.totalDebt;
      text += `📊 <b>Jami qarz:</b> ${formatMoneyFull(totalDebt)}\n`;
      text += `   🏪 Pastavshiklar: ${formatMoneyFull(supplierDebts.totalDebt)}\n`;
      text += `   👷 Ustalar: ${formatMoneyFull(workerDebts.totalDebt)}\n\n`;

      if (allDebts.length === 0) {
        text += `Qarzlar yo'q ✅`;
        const keyboard = new InlineKeyboard()
          .text('📊 Statistika', 'boss:dashboard').row()
          .text('🔙 Menyu', 'main_menu');
        if (ctx.callbackQuery) {
          await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
        } else {
          await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
        }
        return;
      }

      // Determine current index
      const currentIndex = index ?? ctx.session.bossDebtsIndex ?? 0;
      const safeIndex = Math.max(0, Math.min(currentIndex, allDebts.length - 1));
      ctx.session.bossDebtsIndex = safeIndex;

      const debt = allDebts[safeIndex];
      const total = allDebts.length;
      const typeIcon = debt.type === 'supplier' ? '🏪' : '👷';
      const typeText = debt.type === 'supplier' ? 'Pastavshik' : 'Usta';

      text += `${typeIcon} <b>${escapeHtml(debt.name)}</b>\n`;
      text += `   📋 Turi: ${typeText}\n`;
      text += `   💰 Qarz: ${formatMoneyFull(debt.amount)}\n`;

      const keyboard = new InlineKeyboard();

      // Navigation row (only if more than 1 item)
      if (total > 1) {
        keyboard.text('◀️ Oldingi', 'boss:debts_prev');
        keyboard.text(`${safeIndex + 1}/${total}`, 'noop');
        keyboard.text('Keyingi ▶️', 'boss:debts_next');
        keyboard.row();
      }

      keyboard.text('📊 Statistika', 'boss:dashboard').row();
      keyboard.text('🔙 Menyu', 'main_menu');

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

  async handleDebtsPrev(ctx: BotContext): Promise<void> {
    const currentIndex = ctx.session?.bossDebtsIndex ?? 0;
    const total = ctx.session?.bossDebtIds?.length ?? 0;
    const newIndex = currentIndex > 0 ? currentIndex - 1 : total - 1;
    await this.handleDebts(ctx, newIndex);
  }

  async handleDebtsNext(ctx: BotContext): Promise<void> {
    const currentIndex = ctx.session?.bossDebtsIndex ?? 0;
    const total = ctx.session?.bossDebtIds?.length ?? 0;
    const newIndex = currentIndex < total - 1 ? currentIndex + 1 : 0;
    await this.handleDebts(ctx, newIndex);
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

  async handlePending(ctx: BotContext, index?: number): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const projectId = ctx.session?.selectedProjectId;

      // Collect all pending items
      type PendingItem = { type: 'request' | 'cash' | 'expense'; id: string; data: any };
      const allPending: PendingItem[] = [];

      // Pending material requests
      const pendingRequests = await this.requestsService.findAll(
        { projectId, status: RequestStatus.PENDING, page: 1, limit: 100 },
        user,
      );
      for (const req of pendingRequests.data) {
        allPending.push({ type: 'request', id: req.id, data: req });
      }

      // Pending cash requests
      const pendingCash = await this.cashRequestsService.findAll(
        { projectId, status: CashRequestStatus.PENDING, page: 1, limit: 100 },
        user,
      );
      for (const cr of pendingCash.data) {
        allPending.push({ type: 'cash', id: cr.id, data: cr });
      }

      // Pending expenses (isPaid=false)
      const pendingExpenses = await this.expensesService.findAllExpenses(
        { projectId, isPaid: false, page: 1, limit: 100 },
        user,
      );
      for (const exp of pendingExpenses.data) {
        allPending.push({ type: 'expense', id: exp.id, data: exp });
      }

      // Cache IDs for navigation
      ctx.session.bossPendingIds = allPending.map((p) => `${p.type}:${p.id}`);

      let text = `⏳ <b>KUTILAYOTGAN SO'ROVLAR</b>\n`;
      text += `🏗️ ${ctx.session?.selectedProjectName}\n\n`;

      // Show summary counts
      text += `📊 <b>Jami:</b> ${allPending.length} ta\n`;
      text += `   📦 Material: ${pendingRequests.data.length}\n`;
      text += `   💰 Pul: ${pendingCash.data.length}\n`;
      text += `   💸 Rasxod: ${pendingExpenses.data.length}\n\n`;

      if (allPending.length === 0) {
        text += `Kutilayotgan so'rovlar yo'q ✅`;
        const keyboard = new InlineKeyboard()
          .text('📊 Statistika', 'boss:dashboard').row()
          .text('🔙 Menyu', 'main_menu');
        if (ctx.callbackQuery) {
          await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
        } else {
          await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
        }
        return;
      }

      // Determine current index
      const currentIndex = index ?? ctx.session.bossPendingIndex ?? 0;
      const safeIndex = Math.max(0, Math.min(currentIndex, allPending.length - 1));
      ctx.session.bossPendingIndex = safeIndex;

      const item = allPending[safeIndex];
      const total = allPending.length;

      if (item.type === 'request') {
        const req = item.data;
        text += `📦 <b>MATERIAL SO'ROVI</b>\n\n`;
        text += `📦 ${escapeHtml(req.smetaItem?.name || 'Noma\'lum')}\n`;
        text += `   📊 Miqdor: ${req.requestedQty} ${escapeHtml(req.smetaItem?.unit || '')}\n`;
        if (req.requestedAmount) text += `   💰 Summa: ${formatMoneyFull(req.requestedAmount)}\n`;
        if (req.note) text += `   📝 ${escapeHtml(req.note)}\n`;
        if (req.requestedBy?.name) text += `   👷 So'ragan: ${escapeHtml(req.requestedBy.name)}\n`;
        ctx.session.bossPendingType = 'request';
      } else if (item.type === 'cash') {
        const cr = item.data;
        text += `💰 <b>PUL ZAYAVKASI</b>\n\n`;
        text += `💰 ${formatMoneyFull(cr.amount)}\n`;
        if (cr.reason) text += `   📝 Sabab: ${escapeHtml(cr.reason)}\n`;
        if (cr.requestedBy?.name) text += `   👤 So'ragan: ${escapeHtml(cr.requestedBy.name)}\n`;
        ctx.session.bossPendingType = 'cash';
      } else {
        const exp = item.data;
        text += `💸 <b>RASXOD</b>\n\n`;
        text += `💸 ${formatMoneyFull(exp.amount)} — ${escapeHtml(exp.recipient)}\n`;
        if (exp.category) text += `   📋 Kategoriya: ${exp.category}\n`;
        if (exp.note) text += `   📝 ${escapeHtml(exp.note)}\n`;
        if (exp.recordedBy?.name) text += `   👤 Kiritgan: ${escapeHtml(exp.recordedBy.name)}\n`;
        ctx.session.bossPendingType = 'expense';
      }

      const keyboard = new InlineKeyboard();

      // Navigation row (only if more than 1 item)
      if (total > 1) {
        keyboard.text('◀️ Oldingi', 'boss:pending_prev');
        keyboard.text(`${safeIndex + 1}/${total}`, 'noop');
        keyboard.text('Keyingi ▶️', 'boss:pending_next');
        keyboard.row();
      }

      // Action buttons based on type
      if (item.type === 'request') {
        keyboard.text('✅ Tasdiqlash', `boss:ar:${item.id}`);
        keyboard.text('❌ Rad etish', `boss:rr:${item.id}`);
        keyboard.row();
      } else if (item.type === 'cash') {
        keyboard.text('✅ Tasdiqlash', `boss:ac:${item.id}`);
        keyboard.text('❌ Rad etish', `boss:rc:${item.id}`);
        keyboard.row();
      } else {
        keyboard.text('✅ Tasdiqlash', `boss:ae:${item.id}`);
        keyboard.text('❌ Rad etish', `boss:re:${item.id}`);
        keyboard.row();
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

  async handlePendingPrev(ctx: BotContext): Promise<void> {
    const currentIndex = ctx.session?.bossPendingIndex ?? 0;
    const total = ctx.session?.bossPendingIds?.length ?? 0;
    const newIndex = currentIndex > 0 ? currentIndex - 1 : total - 1;
    await this.handlePending(ctx, newIndex);
  }

  async handlePendingNext(ctx: BotContext): Promise<void> {
    const currentIndex = ctx.session?.bossPendingIndex ?? 0;
    const total = ctx.session?.bossPendingIds?.length ?? 0;
    const newIndex = currentIndex < total - 1 ? currentIndex + 1 : 0;
    await this.handlePending(ctx, newIndex);
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
