import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';

import { VendorWorkersService } from 'src/modules/vendor/workers/vendor-workers.service';
import { VendorSmetaItemsService } from 'src/modules/vendor/smeta-items/vendor-smeta-items.service';
import { VendorAnalyticsService } from 'src/modules/vendor/analytics/vendor-analytics.service';

import { BotContext } from '../types/context';
import { sessionToUser } from '../helpers/session-to-user';
import { formatMoneyFull, escapeHtml, parseNumber } from '../helpers/format';

@Injectable()
export class PtoMenu {
  private readonly logger = new Logger(PtoMenu.name);

  constructor(
    private readonly workersService: VendorWorkersService,
    private readonly smetaItemsService: VendorSmetaItemsService,
    private readonly analyticsService: VendorAnalyticsService,
  ) {}

  // --- Menu handlers ---

  async handleProgress(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const projectId = ctx.session?.selectedProjectId;

      const smetaItems = await this.smetaItemsService.findAll(
        { projectId, page: 1, limit: 100 },
        user,
      );

      let text = `📊 <b>LOYIHA BAJARILISHI</b>\n`;
      text += `🏗️ ${ctx.session?.selectedProjectName}\n\n`;

      if (smetaItems.data.length === 0) {
        text += `Smeta elementlari topilmadi.`;
      } else {
        // Calculate overall project completion by cost
        const totalPlanned = smetaItems.data.reduce((s, i) => s + (i.totalAmount || 0), 0);
        const totalUsed = smetaItems.data.reduce((s, i) => s + (i.usedAmount || 0), 0);
        const overallPct = totalPlanned > 0 ? (totalUsed / totalPlanned) * 100 : 0;

        // Progress bar
        const barLen = 20;
        const filled = Math.min(barLen, Math.round((overallPct / 100) * barLen));
        const bar = '▓'.repeat(filled) + '░'.repeat(barLen - filled);

        text += `<b>Umumiy bajarilish:</b>\n`;
        text += `${bar} <b>${overallPct.toFixed(1)}%</b>\n`;
        text += `Reja: ${formatMoneyFull(totalPlanned)}\n`;
        text += `Fakt: ${formatMoneyFull(totalUsed)}\n\n`;

        // Per-item breakdown
        text += `<b>Elementlar bo'yicha:</b>\n\n`;
        for (const item of smetaItems.data.slice(0, 20)) {
          const itemPct = item.quantity > 0
            ? ((item.usedQuantity || 0) / item.quantity) * 100
            : 0;
          const emoji = itemPct >= 100 ? '✅' : itemPct > 80 ? '🟡' : itemPct > 0 ? '🔵' : '⚪';

          text += `${emoji} <b>${escapeHtml(item.name)}</b>\n`;
          text += `  ${item.usedQuantity || 0}/${item.quantity} ${escapeHtml(item.unit)} — ${itemPct.toFixed(0)}%\n`;
        }
        if (smetaItems.total > 20) {
          text += `\n... va yana ${smetaItems.total - 20} ta element\n`;
        }
      }

      const keyboard = new InlineKeyboard()
        .text('📐 Smeta vs Fakt', 'pto:comparison').row()
        .text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Progress error', error);
      await ctx.reply('Loyiha bajarilishini yuklashda xatolik yuz berdi.');
    }
  }

  async handleComparison(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const projectId = ctx.session?.selectedProjectId;

      // Fetch smeta items for this project
      const smetaItems = await this.smetaItemsService.findAll(
        { projectId, page: 1, limit: 50 },
        user,
      );

      // Fetch work completion analytics
      const workCompletion = await this.analyticsService.getWorkCompletion(user);

      let text = `📐 <b>SMETA vs FAKT</b>\n`;
      text += `🏗️ ${ctx.session?.selectedProjectName}\n\n`;

      // Show project-level validation stats
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

      // Show smeta items with used vs planned
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
        .text('✅ Tasdiqlash', 'pto:pending').row()
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
          .text('📐 Smeta vs Fakt', 'pto:comparison').row()
          .text('🔙 Menyu', 'main_menu');

        if (ctx.callbackQuery) {
          await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
        } else {
          await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
        }
        return;
      }

      text += `Jami: ${unvalidated.total} ta ish tasdiqlash kutmoqda\n\n`;

      // Show first unvalidated work log for approval
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
        .text('✅ Tasdiqlash', `pto:approve:${log.id}`)
        .text('✏️ Narx bilan', `pto:approve_price:${log.id}`).row()
        .text('❌ Rad etish', `pto:reject:${log.id}`).row()
        .text('⏩ Keyingisi', 'pto:pending').row()
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
      // Show next pending
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
      ctx.session.ptoPendingApproveId = workLogId;
    } catch (error) {
      this.logger.error('Approve with price error', error);
      await ctx.reply('Xatolik yuz berdi.');
    }
  }

  async handlePriceInput(ctx: BotContext): Promise<void> {
    const workLogId = ctx.session?.ptoPendingApproveId;
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
      ctx.session.ptoPendingApproveId = undefined;
      await ctx.reply('Ish narx bilan tasdiqlandi! ✅');
      await this.handlePending(ctx);
    } catch (error) {
      this.logger.error('Validate with price error', error);
      ctx.session.ptoPendingApproveId = undefined;
      await ctx.reply('Tasdiqlashda xatolik yuz berdi.');
    }
  }

  async handleReject(ctx: BotContext, workLogId: string): Promise<void> {
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
