import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';

import { VendorRequestsService } from 'src/modules/vendor/requests/vendor-requests.service';
import { VendorWorkersService } from 'src/modules/vendor/workers/vendor-workers.service';
import { VendorSmetaItemsService } from 'src/modules/vendor/smeta-items/vendor-smeta-items.service';
import { VendorAnalyticsService } from 'src/modules/vendor/analytics/vendor-analytics.service';
import { RequestStatus } from 'src/common/database/schemas';

import { BotContext } from '../types/context';
import { sessionToUser } from '../helpers/session-to-user';
import { formatMoneyFull, escapeHtml, parseNumber } from '../helpers/format';

@Injectable()
export class DirekterMenu {
  private readonly logger = new Logger(DirekterMenu.name);

  constructor(
    private readonly requestsService: VendorRequestsService,
    private readonly workersService: VendorWorkersService,
    private readonly smetaItemsService: VendorSmetaItemsService,
    private readonly analyticsService: VendorAnalyticsService,
  ) {}

  // --- Material Requests (Zayavkalar) ---

  async handleRequests(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const projectId = ctx.session?.selectedProjectId;

      const pendingRequests = await this.requestsService.findAll(
        { projectId, status: RequestStatus.PENDING, page: 1, limit: 10 },
        user,
      );

      let text = `📦 <b>ZAYAVKALAR</b>\n`;
      text += `🏗️ ${ctx.session?.selectedProjectName}\n\n`;

      const keyboard = new InlineKeyboard();

      if (pendingRequests.data.length === 0) {
        text += `Kutilayotgan zayavkalar yo'q ✅`;
      } else {
        text += `Jami: ${pendingRequests.total} ta zayavka kutilmoqda\n\n`;
        for (let i = 0; i < pendingRequests.data.length; i++) {
          const req = pendingRequests.data[i];
          const num = i + 1;
          text += `  <b>#${num}</b> ${escapeHtml(req.smetaItem?.name || 'Noma\'lum')} — ${req.requestedQty} ${escapeHtml(req.smetaItem?.unit || '')}`;
          if (req.requestedAmount) text += ` | ${formatMoneyFull(req.requestedAmount)}`;
          if (req.note) text += `\n  📝 ${escapeHtml(req.note)}`;
          text += `\n`;
          keyboard.text(`✅ #${num}`, `dir:ar:${req.id}`).text(`❌ #${num}`, `dir:rr:${req.id}`).row();
        }
        if (pendingRequests.total > 10) {
          text += `  ... va yana ${pendingRequests.total - 10} ta\n`;
        }
      }

      keyboard.text('🔙 Menyu', 'main_menu');

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

  async handleApproveRequest(ctx: BotContext, requestId: string): Promise<void> {
    try {
      const user = sessionToUser(ctx.session, ctx.from!.id);
      await this.requestsService.approve(requestId, user);
      await ctx.reply('Material so\'rovi tasdiqlandi! ✅');
      await this.handleRequests(ctx);
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
      await this.handleRequests(ctx);
    } catch (error) {
      this.logger.error('Reject request error', error);
      await ctx.reply('Rad etishda xatolik yuz berdi. ❌');
    }
  }

  // --- Smeta vs Fakt ---

  async handleComparison(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const projectId = ctx.session?.selectedProjectId;

      const smetaItems = await this.smetaItemsService.findAll(
        { projectId, page: 1, limit: 50 },
        user,
      );

      const workCompletion = await this.analyticsService.getWorkCompletion(user);

      let text = `📐 <b>SMETA vs FAKT</b>\n`;
      text += `🏗️ ${ctx.session?.selectedProjectName}\n\n`;

      const projectStats = workCompletion.projects?.find(
        (p) => p.projectId === projectId,
      );
      if (projectStats) {
        text += `📊 <b>Umumiy ko'rsatkichlar:</b>\n`;
        text += `  Jami ishlar: ${projectStats.totalWorkLogs}\n`;
        text += `  Tasdiqlangan: ${projectStats.validatedWorkLogs}\n`;
        text += `  Tasdiqlash %: ${projectStats.validationPercentage?.toFixed(1)}%\n`;
        text += `  Umumiy summa: ${formatMoneyFull(projectStats.totalAmount || 0)}\n`;
        text += `  Tasdiqlangan summa: ${formatMoneyFull(projectStats.validatedAmount || 0)}\n\n`;
      }

      if (smetaItems.data.length === 0) {
        text += `Smeta elementlari topilmadi.`;
      } else {
        text += `📋 <b>Smeta elementlari:</b>\n\n`;
        for (const item of smetaItems.data.slice(0, 15)) {
          const usedPct =
            item.quantity > 0
              ? (((item.usedQuantity || 0) / item.quantity) * 100).toFixed(0)
              : '0';
          const emoji =
            Number(usedPct) > 100 ? '🔴' : Number(usedPct) > 80 ? '🟡' : '🟢';

          text += `${emoji} <b>${escapeHtml(item.name)}</b>\n`;
          text += `  Reja: ${item.quantity} ${escapeHtml(item.unit)} × ${formatMoneyFull(item.unitPrice)} = ${formatMoneyFull(item.totalAmount || 0)}\n`;
          text += `  Fakt: ${item.usedQuantity || 0} ${escapeHtml(item.unit)} = ${formatMoneyFull(item.usedAmount || 0)} (${usedPct}%)\n\n`;
        }
        if (smetaItems.total > 15) {
          text += `... va yana ${smetaItems.total - 15} ta element\n`;
        }
      }

      const keyboard = new InlineKeyboard()
        .text('✅ Tasdiqlash', 'dir:pending').row()
        .text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Comparison error', error);
      await ctx.reply('Smeta taqqoslashini yuklashda xatolik yuz berdi.');
    }
  }

  // --- Work Log Approval (Tasdiqlash) ---

  async handlePending(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const projectId = ctx.session?.selectedProjectId;

      const unvalidated = await this.workersService.findUnvalidatedWorkLogs(
        user, 1, 10, projectId,
      );

      let text = `✅ <b>TASDIQLASH KUTILAYOTGANLAR</b>\n`;
      text += `🏗️ ${ctx.session?.selectedProjectName}\n\n`;

      if (unvalidated.data.length === 0) {
        text += `Barcha ishlar tasdiqlangan! 🎉`;

        const keyboard = new InlineKeyboard()
          .text('📐 Smeta vs Fakt', 'dir:comparison').row()
          .text('🔙 Menyu', 'main_menu');

        if (ctx.callbackQuery) {
          await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
        } else {
          await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
        }
        return;
      }

      text += `Jami: ${unvalidated.total} ta ish tasdiqlash kutmoqda\n\n`;

      const log = unvalidated.data[0];
      const workerName = log.worker?.name || 'Noma\'lum';

      text += `👷 <b>${escapeHtml(workerName)}</b>\n`;
      text += `🔨 Ish turi: ${escapeHtml(log.workType)}\n`;
      text += `📏 Miqdor: ${log.quantity} ${escapeHtml(log.unit)}\n`;
      if (log.unitPrice) {
        text += `💰 Birlik narx: ${formatMoneyFull(log.unitPrice)}\n`;
        text += `💰 Jami: ${formatMoneyFull(log.totalAmount || 0)}\n`;
      }
      if (log.date) {
        text += `📅 Sana: ${log.date}\n`;
      }
      if (log.smetaItem) {
        text += `📐 Smeta: ${escapeHtml(log.smetaItem.name || '')}\n`;
      }

      const keyboard = new InlineKeyboard()
        .text('✅ Tasdiqlash', `dir:approve:${log.id}`)
        .text('✏️ Narx bilan', `dir:approve_price:${log.id}`).row()
        .text('❌ Rad etish', `dir:reject:${log.id}`).row()
        .text('⏩ Keyingisi', 'dir:pending').row()
        .text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Pending error', error);
      await ctx.reply('Kutilayotgan ishlarni yuklashda xatolik yuz berdi.');
    }
  }

  async handleApprove(ctx: BotContext, workLogId: string): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      await this.workersService.validateWorkLog(workLogId, {}, user);
      await ctx.reply('Ish tasdiqlandi! ✅');
      await this.handlePending(ctx);
    } catch (error) {
      this.logger.error('Approve error', error);
      await ctx.reply('Tasdiqlashda xatolik yuz berdi.');
    }
  }

  async handleApproveWithPrice(ctx: BotContext, workLogId: string): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      await ctx.reply('Birlik narxini kiriting (masalan: 45000 yoki 45,000):');
      ctx.session.dirPendingApproveId = workLogId;
    } catch (error) {
      this.logger.error('Approve with price error', error);
      await ctx.reply('Xatolik yuz berdi.');
    }
  }

  async handlePriceInput(ctx: BotContext): Promise<void> {
    const workLogId = ctx.session?.dirPendingApproveId;
    if (!workLogId) return;

    const text = ctx.message?.text;
    if (!text) return;
    const unitPrice = parseNumber(text);
    if (isNaN(unitPrice) || unitPrice <= 0) {
      await ctx.reply('Iltimos, to\'g\'ri raqam kiriting (masalan: 45000 yoki 45,000):');
      return;
    }

    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      await this.workersService.validateWorkLog(workLogId, { unitPrice }, user);
      ctx.session.dirPendingApproveId = undefined;
      await ctx.reply('Ish narx bilan tasdiqlandi! ✅');
      await this.handlePending(ctx);
    } catch (error) {
      this.logger.error('Validate with price error', error);
      ctx.session.dirPendingApproveId = undefined;
      await ctx.reply('Tasdiqlashda xatolik yuz berdi.');
    }
  }

  async handleRejectWorkLog(ctx: BotContext, workLogId: string): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      await this.workersService.deleteWorkLog(workLogId, user);
      await ctx.reply('Ish rad etildi va o\'chirildi. ❌');
      await this.handlePending(ctx);
    } catch (error) {
      this.logger.error('Reject error', error);
      await ctx.reply('Rad etishda xatolik yuz berdi.');
    }
  }
}
