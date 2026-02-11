import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { createConversation } from '@grammyjs/conversations';

import { VendorCashRegistersService } from 'src/modules/vendor/cash-registers/vendor-cash-registers.service';
import { VendorCashRequestsService } from 'src/modules/vendor/cash-requests/vendor-cash-requests.service';
import { VendorExpensesService } from 'src/modules/vendor/expenses/vendor-expenses.service';
import { AiService } from 'src/modules/bot/ai/ai.service';
import { CashTransactionType, PaymentType, ExpenseCategory, UserRole } from 'src/common/database/schemas';
import { DataSource } from 'src/common/database/schemas/smeta-items';

import { BotContext, BotConversation } from '../types/context';
import { sessionToUser } from '../helpers/session-to-user';
import { formatMoneyFull, escapeHtml, parseNumber } from '../helpers/format';
import { buildKassaMenu, buildDateFilterKeyboard } from '../keyboards/kassa.keyboard';
import { runSingleMessageFlow } from '../helpers/single-message-flow';
import { textWithCancel } from '../helpers/cancel';
import {
  FOREMAN_CASH_REQUEST_FORM,
  CASH_TRANSACTION_FORM,
} from '../helpers/form-configs';

@Injectable()
export class KassaMenu {
  private readonly logger = new Logger(KassaMenu.name);

  constructor(
    private readonly cashRegistersService: VendorCashRegistersService,
    private readonly cashRequestsService: VendorCashRequestsService,
    private readonly expensesService: VendorExpensesService,
    private readonly aiService: AiService,
  ) {}

  getConversationMiddleware() {
    return [
      createConversation(this.buildRequestConversation(), 'kassa_request'),
      createConversation(this.buildExpenseConversation(), 'kassa_expense'),
      createConversation(this.buildDateRangeConversation('history'), 'kassa_date_history'),
      createConversation(this.buildDateRangeConversation('expenses'), 'kassa_date_expenses'),
    ];
  }

  // --- Main Kassa menu ---

  async handleKassa(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);

      // Auto-create koshelok
      const koshelok = await this.cashRegistersService.getOrCreateUserKoshelok(user);

      const role = ctx.session?.role as UserRole | undefined;

      const text =
        `💵 <b>KASSA</b>\n\n` +
        `🏦 <b>Loyiha koshelogi</b> — ${formatMoneyFull(koshelok.balance)}\n\n` +
        `Amalni tanlang:`;

      const keyboard = buildKassaMenu(role);

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Kassa menu error', error);
      await ctx.reply('Kassa ma\'lumotlarini yuklashda xatolik yuz berdi.');
    }
  }

  // --- Balance ---

  async handleBalance(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const koshelok = await this.cashRegistersService.getOrCreateUserKoshelok(user);

      const text =
        `💰 <b>BALANS</b>\n\n` +
        `🏦 <b>Loyiha koshelogi</b>\n` +
        `💰 Balans: <b>${formatMoneyFull(koshelok.balance)}</b>\n` +
        `📥 Jami kirim: ${formatMoneyFull(koshelok.totalIn)}\n` +
        `📤 Jami chiqim: ${formatMoneyFull(koshelok.totalOut)}`;

      const keyboard = new InlineKeyboard()
        .text('📋 Koshelok tarixi', 'kassa:history').row()
        .text('🔙 Kassa', 'kassa:menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Balance error', error);
      await ctx.reply('Balansni yuklashda xatolik yuz berdi.');
    }
  }

  // --- History (IN transactions) ---

  async handleHistory(ctx: BotContext): Promise<void> {
    const text = `📋 <b>KOSHELOK TARIXI</b>\n\nDavrni tanlang:`;
    const keyboard = buildDateFilterKeyboard('kassa:hist');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  }

  async handleHistoryFiltered(ctx: BotContext, dateFrom: Date, dateTo: Date): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const koshelok = await this.cashRegistersService.getOrCreateUserKoshelok(user);

      const transactions = await this.cashRegistersService.findCashTransactions(
        koshelok.id, user, 1, 20,
        { dateFrom, dateTo, type: CashTransactionType.IN },
      );

      let text = `📋 <b>KOSHELOK TARIXI (KIRIM)</b>\n`;
      text += `📅 ${dateFrom.toLocaleDateString('uz-UZ')} — ${dateTo.toLocaleDateString('uz-UZ')}\n\n`;

      if (transactions.data.length === 0) {
        text += `Bu davrda kirim operatsiyalar yo'q.`;
      } else {
        for (const tx of transactions.data) {
          text += `📥 +${formatMoneyFull(tx.amount)}`;
          if (tx.note) text += ` — ${escapeHtml(tx.note)}`;
          if (tx.createdAt) text += `\n  📅 ${new Date(tx.createdAt).toLocaleDateString('uz-UZ')}`;
          text += `\n`;
        }
        if (transactions.total > 20) {
          text += `\n... jami ${transactions.total} ta operatsiya`;
        }
      }

      const keyboard = new InlineKeyboard()
        .text('📅 Boshqa davr', 'kassa:history').row()
        .text('🔙 Kassa', 'kassa:menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('History filtered error', error);
      await ctx.reply('Tarixni yuklashda xatolik yuz berdi.');
    }
  }

  // --- Request money ---

  async handleRequestMoney(ctx: BotContext): Promise<void> {
    if (!ctx.session?.selectedProjectId) {
      await ctx.reply('Avval loyihani tanlang.');
      return;
    }
    await ctx.conversation.enter('kassa_request');
  }

  // --- Expenses view ---

  async handleExpenses(ctx: BotContext): Promise<void> {
    const text = `📋 <b>RASXODLAR</b>\n\nDavrni tanlang:`;
    const keyboard = buildDateFilterKeyboard('kassa:exp');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  }

  async handleExpensesFiltered(ctx: BotContext, dateFrom: Date, dateTo: Date): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const koshelok = await this.cashRegistersService.getOrCreateUserKoshelok(user);

      const transactions = await this.cashRegistersService.findCashTransactions(
        koshelok.id, user, 1, 20,
        { dateFrom, dateTo, type: CashTransactionType.OUT },
      );

      let text = `📋 <b>RASXODLAR (CHIQIM)</b>\n`;
      text += `📅 ${dateFrom.toLocaleDateString('uz-UZ')} — ${dateTo.toLocaleDateString('uz-UZ')}\n\n`;

      if (transactions.data.length === 0) {
        text += `Bu davrda chiqim operatsiyalar yo'q.`;
      } else {
        for (const tx of transactions.data) {
          text += `📤 -${formatMoneyFull(tx.amount)}`;
          if (tx.note) text += ` — ${escapeHtml(tx.note)}`;
          if (tx.createdAt) text += `\n  📅 ${new Date(tx.createdAt).toLocaleDateString('uz-UZ')}`;
          text += `\n`;
        }
        if (transactions.total > 20) {
          text += `\n... jami ${transactions.total} ta operatsiya`;
        }
      }

      const keyboard = new InlineKeyboard()
        .text('📅 Boshqa davr', 'kassa:expenses').row()
        .text('🔙 Kassa', 'kassa:menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Expenses filtered error', error);
      await ctx.reply('Rasxodlarni yuklashda xatolik yuz berdi.');
    }
  }

  // --- Add expense ---

  async handleAddExpense(ctx: BotContext): Promise<void> {
    if (!ctx.session?.selectedProjectId) {
      await ctx.reply('Avval loyihani tanlang.');
      return;
    }
    await ctx.conversation.enter('kassa_expense');
  }

  // --- Custom date range (enters conversation) ---

  async handleDateCustom(ctx: BotContext, target: 'history' | 'expenses'): Promise<void> {
    const convName = target === 'history' ? 'kassa_date_history' : 'kassa_date_expenses';
    await ctx.conversation.enter(convName);
  }

  // --- Conversation builders ---

  private buildRequestConversation() {
    const cashRequestsService = this.cashRequestsService;
    const aiService = this.aiService;

    return async function kassaRequest(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const projectId = await conversation.external((ctx) => ctx.session?.selectedProjectId);
      const projectName = await conversation.external((ctx) => ctx.session?.selectedProjectName || '');
      if (!projectId) {
        await ctx.reply('Avval loyihani tanlang: /projects');
        return;
      }

      const result = await runSingleMessageFlow(
        conversation, ctx, FOREMAN_CASH_REQUEST_FORM, aiService, { projectName },
      );
      if (!result || !result.confirmed) return;

      try {
        const user = await conversation.external((ctx) =>
          sessionToUser(ctx.session, ctx.from!.id),
        );
        await conversation.external(() =>
          cashRequestsService.create(
            { projectId, amount: result.data.amount, reason: result.data.reason, source: DataSource.TELEGRAM },
            user,
          ),
        );
        await ctx.reply(
          'Pul so\'rovi yuborildi! ✅\n' +
          `Summa: ${formatMoneyFull(result.data.amount)}\n` +
          'Bugalter tasdiqlashini kuting.',
        );
      } catch {
        await ctx.reply('Pul so\'rovini saqlashda xatolik yuz berdi. ❌');
      }
    };
  }

  private buildExpenseConversation() {
    const cashRegistersService = this.cashRegistersService;
    const expensesService = this.expensesService;
    const aiService = this.aiService;

    return async function kassaExpense(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const projectId = await conversation.external((ctx) => ctx.session?.selectedProjectId);
      const projectName = await conversation.external((ctx) => ctx.session?.selectedProjectName || '');
      if (!projectId) { await ctx.reply('Avval loyihani tanlang: /projects'); return; }

      const user = await conversation.external((ctx) =>
        sessionToUser(ctx.session, ctx.from!.id),
      );

      // Get or create koshelok
      const koshelok = await conversation.external(() =>
        cashRegistersService.getOrCreateUserKoshelok(user),
      );

      await ctx.reply(
        `💸 <b>RASXOD KIRITISH</b>\n` +
        `🏗️ ${escapeHtml(projectName)}\n` +
        `💰 Koshelok balansi: ${formatMoneyFull(koshelok.balance)}`,
        { parse_mode: 'HTML' },
      );

      const result = await runSingleMessageFlow(
        conversation, ctx, CASH_TRANSACTION_FORM, aiService,
        { projectName, preSelectedData: { type: 'OUT' } },
      );
      if (!result || !result.confirmed) return;

      const amount = result.data.amount;
      const recipient = result.data.recipient || '';
      const reason = result.data.reason || '';
      const note = [recipient, reason].filter(Boolean).join(' | ');

      try {
        // 1. Cash OUT from user's koshelok
        await conversation.external(() =>
          cashRegistersService.createCashTransaction(
            { cashRegisterId: koshelok.id, type: CashTransactionType.OUT, amount, note },
            user,
          ),
        );

        // 2. Record as expense (pending boss approval)
        await conversation.external(() =>
          expensesService.createExpense(
            {
              projectId,
              amount,
              recipient: recipient || 'Rasxod',
              paymentType: PaymentType.CASH,
              category: ExpenseCategory.OTHER,
              note: reason || undefined,
              isPaid: false,
            },
            user,
          ),
        );

        await ctx.reply(
          `Rasxod kiritildi: ${formatMoneyFull(amount)} ✅\n` +
          (recipient ? `Kimga: ${escapeHtml(recipient)}\n` : '') +
          'Boss tasdiqlashini kutmoqda.',
          { parse_mode: 'HTML' },
        );
      } catch {
        await ctx.reply('Rasxodni saqlashda xatolik yuz berdi. ❌');
      }
    };
  }

  private buildDateRangeConversation(target: 'history' | 'expenses') {
    const self = this;

    return async function kassaDateRange(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      await ctx.reply(
        '📅 <b>Boshlanish sanasini kiriting</b>\n' +
        'Format: <code>DD.MM.YYYY</code>\n' +
        'Masalan: <code>01.01.2026</code>\n\n' +
        '<i>/cancel - bekor qilish</i>',
        { parse_mode: 'HTML' },
      );

      let dateFrom: Date;
      for (;;) {
        const raw = await textWithCancel(conversation, ctx);
        const parsed = parseDate(raw);
        if (parsed) { dateFrom = parsed; break; }
        await ctx.reply('Noto\'g\'ri format. DD.MM.YYYY formatda kiriting:');
      }

      await ctx.reply(
        '📅 <b>Tugash sanasini kiriting</b>\n' +
        'Format: <code>DD.MM.YYYY</code>',
        { parse_mode: 'HTML' },
      );

      let dateTo: Date;
      for (;;) {
        const raw = await textWithCancel(conversation, ctx);
        const parsed = parseDate(raw);
        if (parsed) {
          // Set to end of day
          parsed.setHours(23, 59, 59, 999);
          dateTo = parsed;
          break;
        }
        await ctx.reply('Noto\'g\'ri format. DD.MM.YYYY formatda kiriting:');
      }

      // Show filtered results
      if (target === 'history') {
        await self.handleHistoryFiltered(ctx, dateFrom!, dateTo!);
      } else {
        await self.handleExpensesFiltered(ctx, dateFrom!, dateTo!);
      }
    };
  }
}

function parseDate(text: string): Date | null {
  const match = text.trim().match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  if (isNaN(d.getTime())) return null;
  return d;
}
