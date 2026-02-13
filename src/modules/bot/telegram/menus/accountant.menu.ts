import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { createConversation } from '@grammyjs/conversations';

import { VendorIncomesService } from 'src/modules/vendor/incomes/vendor-incomes.service';
import { VendorExpensesService } from 'src/modules/vendor/expenses/vendor-expenses.service';
import { VendorCashRegistersService } from 'src/modules/vendor/cash-registers/vendor-cash-registers.service';
import { VendorCashRequestsService } from 'src/modules/vendor/cash-requests/vendor-cash-requests.service';
import { AiService } from 'src/modules/bot/ai/ai.service';
import { CashRequestStatus } from 'src/common/database/schemas';
import { PaymentType } from 'src/common/database/schemas/incomes';
import { ExpenseCategory } from 'src/common/database/schemas/expenses';
import { DataSource } from 'src/common/database/schemas/smeta-items';

import { BotContext, BotConversation } from '../types/context';
import { sessionToUser } from '../helpers/session-to-user';
import { formatMoneyFull, escapeHtml } from '../helpers/format';
import { runSingleMessageFlow } from '../helpers/single-message-flow';
import {
  INCOME_FORM,
  EXPENSE_FORM,
  CASH_REQUEST_FORM,
} from '../helpers/form-configs';

@Injectable()
export class AccountantMenu {
  private readonly logger = new Logger(AccountantMenu.name);

  constructor(
    private readonly incomesService: VendorIncomesService,
    private readonly expensesService: VendorExpensesService,
    private readonly cashRegistersService: VendorCashRegistersService,
    private readonly cashRequestsService: VendorCashRequestsService,
    private readonly aiService: AiService,
  ) {}

  /** Returns conversation middleware array for registration */
  getConversationMiddleware() {
    return [
      createConversation(this.buildIncomeConversation(), 'income'),
      createConversation(this.buildExpenseConversation(), 'expense'),
      createConversation(this.buildZayavkaConversation(), 'acc_cash_request'),
      createConversation(this.buildFillBalanceConversation(), 'fill_balance'),
    ];
  }

  async handleFillBalance(ctx: BotContext): Promise<void> {
    if (!ctx.session?.selectedProjectId) {
      await ctx.reply('Avval loyihani tanlang: /projects');
      return;
    }
    await ctx.conversation.enter('fill_balance');
  }

  async handleIncome(ctx: BotContext): Promise<void> {
    if (!ctx.session?.selectedProjectId) {
      await ctx.reply('Avval loyihani tanlang: /projects');
      return;
    }
    await ctx.conversation.enter('income');
  }

  async handleExpense(ctx: BotContext): Promise<void> {
    if (!ctx.session?.selectedProjectId) {
      await ctx.reply('Avval loyihani tanlang: /projects');
      return;
    }
    await ctx.conversation.enter('expense');
  }

  async handleRequests(ctx: BotContext): Promise<void> {
    if (!ctx.session?.selectedProjectId) {
      await ctx.reply('Avval loyihani tanlang: /projects');
      return;
    }
    try {
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const requests = await this.cashRequestsService.findAll(
        { projectId: ctx.session.selectedProjectId, status: CashRequestStatus.PENDING, page: 1, limit: 10 },
        user,
      );

      let text = `\u{1F4CB} <b>ZAYAVKALAR</b>\n`;
      text += `\u{1F3D7}\u{FE0F} ${ctx.session.selectedProjectName}\n\n`;

      const keyboard = new InlineKeyboard();

      if (requests.data.length === 0) {
        text += `Zayavkalar yo'q.`;
      } else {
        const statusLabels: Record<string, string> = {
          PENDING: '\u{23F3} Kutilmoqda',
          APPROVED: '\u{2705} Tasdiqlangan',
          REJECTED: '\u{274C} Rad etilgan',
        };
        for (let i = 0; i < requests.data.length; i++) {
          const req = requests.data[i];
          const num = i + 1;
          text += `${statusLabels[req.status] || req.status}\n`;
          text += `  \u{1F4B5} Summa: <b>${formatMoneyFull(req.amount)}</b>\n`;
          if (req.requestedBy?.name) text += `  \u{1F464} ${escapeHtml(req.requestedBy.name)}\n`;
          if (req.reason) text += `  \u{1F4DD} Sabab: ${escapeHtml(req.reason)}\n`;
          if (req.neededBy) text += `  \u{1F4C6} Davr: ${new Date(req.neededBy).toLocaleDateString('uz-UZ')}\n`;
          if (req.status === 'PENDING') {
            keyboard.text(`\u{2705} #${num} Tasdiqlash`, `acc:approve_cash:${req.id}`)
              .text(`\u{274C} #${num} Rad`, `acc:reject_cash:${req.id}`).row();
          }
          text += `\n`;
        }
        if (requests.total > 10) {
          text += `Jami ${requests.total} ta zayavka\n`;
        }
      }

      keyboard.text('\u{2795} Yangi zayavka', 'acc:new_request').row();
      keyboard.text('\u{1F519} Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Requests error', error);
      await ctx.reply('Zayavkalarni yuklashda xatolik yuz berdi.');
    }
  }

  async handleApproveCashRequest(ctx: BotContext, cashRequestId: string): Promise<void> {
    try {
      const user = sessionToUser(ctx.session, ctx.from!.id);
      await this.cashRequestsService.approve(cashRequestId, user);
      await ctx.reply('Pul zayavkasi tasdiqlandi va koshelokga tushirildi! \u{2705}');
      await this.handleRequests(ctx);
    } catch (error) {
      this.logger.error('Approve cash request error', error);
      await ctx.reply('Tasdiqlashda xatolik yuz berdi. \u{274C}');
    }
  }

  async handleRejectCashRequest(ctx: BotContext, cashRequestId: string): Promise<void> {
    try {
      const user = sessionToUser(ctx.session, ctx.from!.id);
      await this.cashRequestsService.reject(cashRequestId, {}, user);
      await ctx.reply('Pul zayavkasi rad etildi. \u{274C}');
      await this.handleRequests(ctx);
    } catch (error) {
      this.logger.error('Reject cash request error', error);
      await ctx.reply('Rad etishda xatolik yuz berdi. \u{274C}');
    }
  }

  async handleNewRequest(ctx: BotContext): Promise<void> {
    if (!ctx.session?.selectedProjectId) {
      await ctx.reply('Avval loyihani tanlang: /projects');
      return;
    }
    await ctx.conversation.enter('acc_cash_request');
  }

  // --- Conversation builders ---

  private buildIncomeConversation() {
    const incomesService = this.incomesService;
    const aiService = this.aiService;

    return async function incomeConversation(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const projectId = await conversation.external((ctx) => ctx.session?.selectedProjectId);
      const projectName = await conversation.external((ctx) => ctx.session?.selectedProjectName || '');
      if (!projectId) {
        await ctx.reply('Avval loyihani tanlang: /projects');
        return;
      }

      const result = await runSingleMessageFlow(conversation, ctx, INCOME_FORM, aiService, { projectName });
      if (!result || !result.confirmed) return;

      try {
        const user = await conversation.external((ctx) => sessionToUser(ctx.session, ctx.from!.id));
        await conversation.external(() =>
          incomesService.createIncome(
            {
              projectId,
              amount: result.data.amount,
              source: result.data.source,
              paymentType: (result.data.paymentType || 'CASH') as PaymentType,
              note: result.data.note,
            },
            user,
          ),
        );
        await ctx.reply('Kirim muvaffaqiyatli qo\'shildi! \u{2705}');
      } catch {
        await ctx.reply('Kirimni saqlashda xatolik yuz berdi. \u{274C}');
      }
    };
  }

  private buildExpenseConversation() {
    const expensesService = this.expensesService;
    const aiService = this.aiService;

    return async function expenseConversation(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const projectId = await conversation.external((ctx) => ctx.session?.selectedProjectId);
      const projectName = await conversation.external((ctx) => ctx.session?.selectedProjectName || '');
      if (!projectId) {
        await ctx.reply('Avval loyihani tanlang: /projects');
        return;
      }

      const result = await runSingleMessageFlow(conversation, ctx, EXPENSE_FORM, aiService, { projectName });
      if (!result || !result.confirmed) return;

      try {
        const user = await conversation.external((ctx) => sessionToUser(ctx.session, ctx.from!.id));
        await conversation.external(() =>
          expensesService.createExpense(
            {
              projectId,
              amount: result.data.amount,
              recipient: result.data.recipient,
              paymentType: (result.data.paymentType || 'CASH') as PaymentType,
              category: (result.data.category || 'OTHER') as ExpenseCategory,
              note: result.data.note,
            },
            user,
          ),
        );
        await ctx.reply('Chiqim muvaffaqiyatli qo\'shildi! \u{2705}');
      } catch {
        await ctx.reply('Chiqimni saqlashda xatolik yuz berdi. \u{274C}');
      }
    };
  }

  private buildZayavkaConversation() {
    const cashRequestsService = this.cashRequestsService;
    const aiService = this.aiService;

    return async function accCashRequest(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const projectId = await conversation.external((ctx) => ctx.session?.selectedProjectId);
      const projectName = await conversation.external((ctx) => ctx.session?.selectedProjectName || '');
      if (!projectId) {
        await ctx.reply('Avval loyihani tanlang: /projects');
        return;
      }

      const result = await runSingleMessageFlow(conversation, ctx, CASH_REQUEST_FORM, aiService, { projectName });
      if (!result || !result.confirmed) return;

      try {
        const user = await conversation.external((ctx) => sessionToUser(ctx.session, ctx.from!.id));
        const fullReason = [result.data.reason, result.data.period ? `Davr: ${result.data.period}` : '']
          .filter(Boolean)
          .join(' | ');

        await conversation.external(() =>
          cashRequestsService.create(
            { projectId, amount: result.data.amount, reason: fullReason, source: DataSource.TELEGRAM },
            user,
          ),
        );
        await ctx.reply('Zayavka muvaffaqiyatli yuborildi! \u{2705}');
      } catch {
        await ctx.reply('Zayavkani saqlashda xatolik yuz berdi. \u{274C}');
      }
    };
  }

  private buildFillBalanceConversation() {
    const cashRegistersService = this.cashRegistersService;
    const logger = this.logger;

    return async function fillBalance(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const projectId = await conversation.external((ctx) => ctx.session?.selectedProjectId);
      const projectName = await conversation.external((ctx) => ctx.session?.selectedProjectName || '');
      if (!projectId) {
        await ctx.reply('Avval loyihani tanlang: /projects');
        return;
      }

      await ctx.reply(
        `\u{1F4B3} <b>BALANS TO'LDIRISH</b>\n` +
        `\u{1F3D7}\u{FE0F} ${projectName}\n\n` +
        `Summani kiriting (so'm):\n` +
        `Masalan: <code>50,000,000</code>\n\n` +
        `<i>/cancel - bekor qilish</i>`,
        { parse_mode: 'HTML' },
      );

      let amount: number;
      for (;;) {
        const raw = await conversation.form.text();
        if (raw.toLowerCase() === '/cancel') {
          await ctx.reply('Bekor qilindi.');
          return;
        }
        const parsed = parseFloat(raw.replace(/[\s,_]/g, ''));
        if (isNaN(parsed) || parsed <= 0) {
          await ctx.reply('Noto\'g\'ri summa. Qaytadan kiriting:');
          continue;
        }
        amount = parsed;
        break;
      }

      try {
        const user = await conversation.external((ctx) => sessionToUser(ctx.session, ctx.from!.id));

        // Add to balance via cash register service
        await conversation.external(() =>
          cashRegistersService.addToBalance(projectId, amount, user),
        );

        await ctx.reply(
          `\u{2705} Balans to'ldirildi!\n` +
          `Summa: <b>${amount.toLocaleString('uz-UZ')} so'm</b>`,
          { parse_mode: 'HTML' },
        );
      } catch (error) {
        logger.error('Fill balance error', error);
        await ctx.reply('Balansni to\'ldirishda xatolik yuz berdi. \u{274C}');
      }
    };
  }
}
