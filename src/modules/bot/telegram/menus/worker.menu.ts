import { Injectable } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';

import { VendorWorkersService } from 'src/modules/vendor/workers/vendor-workers.service';

import { BotContext } from '../types/context';
import { sessionToUser } from '../helpers/session-to-user';
import { formatMoneyFull, escapeHtml } from '../helpers/format';

const LOGS_PER_PAGE = 5;
const PAYMENTS_PER_PAGE = 5;

@Injectable()
export class WorkerMenu {
  constructor(
    private readonly workersService: VendorWorkersService,
  ) {}

  async handleSummary(ctx: BotContext): Promise<void> {
    const user = sessionToUser(ctx.session, ctx.from!.id);
    const worker = await this.workersService.findWorkerByUserId(user.id, user);

    if (!worker) {
      await ctx.reply(
        'Siz hali ishchi sifatida ro\'yxatdan o\'tmagansiz.\n' +
        'Prorab bilan bog\'laning.',
      );
      return;
    }

    const debt = worker.totalEarned - worker.totalPaid;
    let debtLine: string;
    if (debt > 0) {
      debtLine = `🔴 Qarz (sizga): <b>${formatMoneyFull(debt)}</b>`;
    } else if (debt < 0) {
      debtLine = `🟢 Ortiqcha to'langan: <b>${formatMoneyFull(Math.abs(debt))}</b>`;
    } else {
      debtLine = `⚪ Hisob barobar`;
    }

    const text =
      `📊 <b>HISOB-KITOB</b>\n\n` +
      `👤 Ism: <b>${escapeHtml(worker.name)}</b>\n` +
      (worker.specialty ? `🔧 Mutaxassislik: ${escapeHtml(worker.specialty)}\n` : '') +
      `\n` +
      `💰 Jami ishlangan: <b>${formatMoneyFull(worker.totalEarned)}</b>\n` +
      `💵 To'langan: <b>${formatMoneyFull(worker.totalPaid)}</b>\n` +
      `${debtLine}\n`;

    const kb = new InlineKeyboard()
      .text('📐 Bajarilgan ishlar', 'worker:worklogs').row()
      .text('💰 To\'lovlar', 'worker:payments').row()
      .text('🔙 Menyu', 'main_menu');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  }

  async handleWorkLogs(ctx: BotContext, page = 1): Promise<void> {
    const user = sessionToUser(ctx.session, ctx.from!.id);
    const worker = await this.workersService.findWorkerByUserId(user.id, user);

    if (!worker) {
      await ctx.reply('Ishchi topilmadi.');
      return;
    }

    const result = await this.workersService.findAllWorkLogs(
      user, page, LOGS_PER_PAGE, worker.id,
    );

    if (result.data.length === 0) {
      const text = '📐 <b>BAJARILGAN ISHLAR</b>\n\nHali hech qanday ish qayd etilmagan.';
      const kb = new InlineKeyboard().text('🔙 Orqaga', 'worker:summary');
      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
      }
      return;
    }

    let text = `📐 <b>BAJARILGAN ISHLAR</b>\n\n`;

    for (const log of result.data) {
      const status = log.isValidated ? '✅' : '⏳';
      const date = new Date(log.date).toLocaleDateString('uz-UZ');
      const projectName = log.project?.name || '—';
      const amount = log.totalAmount ? formatMoneyFull(log.totalAmount) : '—';
      text += `${status} ${date} | ${escapeHtml(projectName)}\n`;
      text += `${escapeHtml(log.workType)}: ${log.quantity} ${escapeHtml(log.unit)}`;
      if (log.unitPrice) {
        text += ` × ${formatMoneyFull(log.unitPrice)} = ${amount}`;
      }
      text += `\n\n`;
    }

    const totalPages = Math.ceil(result.total / LOGS_PER_PAGE);
    const kb = new InlineKeyboard();

    if (totalPages > 1) {
      if (page > 1) kb.text('◀️', `worker:worklogs:${page - 1}`);
      kb.text(`${page}/${totalPages}`, 'noop');
      if (page < totalPages) kb.text('▶️', `worker:worklogs:${page + 1}`);
      kb.row();
    }
    kb.text('🔙 Orqaga', 'worker:summary');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  }

  async handlePayments(ctx: BotContext, page = 1): Promise<void> {
    const user = sessionToUser(ctx.session, ctx.from!.id);
    const worker = await this.workersService.findWorkerByUserId(user.id, user);

    if (!worker) {
      await ctx.reply('Ishchi topilmadi.');
      return;
    }

    const result = await this.workersService.findAllPayments(
      user, page, PAYMENTS_PER_PAGE, worker.id,
    );

    if (result.data.length === 0) {
      const text = '💰 <b>TO\'LOVLAR</b>\n\nHali hech qanday to\'lov amalga oshirilmagan.';
      const kb = new InlineKeyboard().text('🔙 Orqaga', 'worker:summary');
      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
      }
      return;
    }

    let text = `💰 <b>TO'LOVLAR</b>\n\n`;

    for (const pay of result.data) {
      const date = new Date(pay.createdAt).toLocaleDateString('uz-UZ');
      text += `${date}\n`;
      text += `<b>${formatMoneyFull(pay.amount)}</b>\n`;
      text += `To'lagan: ${escapeHtml(pay.paidBy.name)}\n`;
      if (pay.note) {
        text += `Izoh: ${escapeHtml(pay.note)}\n`;
      }
      text += `\n`;
    }

    const totalPages = Math.ceil(result.total / PAYMENTS_PER_PAGE);
    const kb = new InlineKeyboard();

    if (totalPages > 1) {
      if (page > 1) kb.text('◀️', `worker:payments:${page - 1}`);
      kb.text(`${page}/${totalPages}`, 'noop');
      if (page < totalPages) kb.text('▶️', `worker:payments:${page + 1}`);
      kb.row();
    }
    kb.text('🔙 Orqaga', 'worker:summary');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  }
}
