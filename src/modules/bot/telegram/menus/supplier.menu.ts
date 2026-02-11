import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';

import { VendorSuppliersService } from 'src/modules/vendor/suppliers/vendor-suppliers.service';

import { BotContext } from '../types/context';
import { sessionToUser } from '../helpers/session-to-user';
import { formatMoneyFull, escapeHtml } from '../helpers/format';

@Injectable()
export class SupplierMenu {
  private readonly logger = new Logger(SupplierMenu.name);

  constructor(
    private readonly suppliersService: VendorSuppliersService,
  ) {}

  async handleSummary(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);

      const supplier = await this.suppliersService.findSupplierByUserId(user.id, user);

      if (!supplier) {
        await ctx.reply('Sizga bog\'langan postavshik topilmadi. Operator bilan bog\'laning.');
        return;
      }

      // Get orders total
      const orders = await this.suppliersService.findAllSupplyOrders(
        { supplierId: supplier.id, page: 1, limit: 1 },
        user,
      );

      // Calculate totals from debts
      const allDebts = await this.suppliersService.findSupplierDebtsByFilter(user, {
        supplierId: supplier.id,
      });

      let totalGoods = 0;
      let totalPaid = 0;
      let totalUnpaid = 0;

      for (const d of allDebts.data) {
        if (d.isPaid) {
          totalPaid += d.amount;
        } else {
          totalUnpaid += d.amount;
        }
        totalGoods += d.amount;
      }

      let text = `\u{1F4CA} <b>HISOB-KITOB</b>\n\n`;
      text += `\u{1F464} Postavshik: <b>${escapeHtml(supplier.name)}</b>\n\n`;
      text += `\u{1F4E6} Berilgan tovar: <b>${formatMoneyFull(totalGoods)}</b>\n`;
      text += `\u{1F4B5} Olingan pullar: <b>${formatMoneyFull(totalPaid)}</b>\n`;
      text += `\u{23F3} Qoldiq qarz: <b>${formatMoneyFull(totalUnpaid)}</b>\n`;

      const keyboard = new InlineKeyboard()
        .text('\u{1F4E6} Berilgan tovar', 'supplier:orders').row()
        .text('\u{1F4B0} Olingan pullar', 'supplier:payments');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Supplier summary error', error);
      await ctx.reply('Ma\'lumotlarni yuklashda xatolik yuz berdi.');
    }
  }

  async handleOrders(ctx: BotContext, page = 1): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);

      const supplier = await this.suppliersService.findSupplierByUserId(user.id, user);
      if (!supplier) {
        await ctx.reply('Sizga bog\'langan postavshik topilmadi.');
        return;
      }

      const orders = await this.suppliersService.findAllSupplyOrders(
        { supplierId: supplier.id, page, limit: 10 },
        user,
      );

      let text = `\u{1F4E6} <b>BERILGAN TOVAR</b>\n\u{1F464} ${escapeHtml(supplier.name)}\n\n`;

      if (orders.data.length === 0) {
        text += `Buyurtmalar topilmadi.`;
      } else {
        for (const order of orders.data) {
          const statusEmoji = order.status === 'DELIVERED' ? '\u{2705}'
            : order.status === 'ORDERED' ? '\u{23F3}'
            : order.status === 'PARTIAL' ? '\u{1F550}'
            : '\u{274C}';
          text += `${statusEmoji} <b>${formatMoneyFull(order.totalCost)}</b>`;
          if (order.project?.name) text += ` \u{2014} ${escapeHtml(order.project.name)}`;
          text += `\n`;
          if (order.note) text += `  ${escapeHtml(order.note)}\n`;
          text += `  \u{1F4C5} ${new Date(order.createdAt).toLocaleDateString('uz-UZ')}\n\n`;
        }
      }

      const keyboard = new InlineKeyboard();
      const totalPages = Math.ceil(orders.total / 10);
      if (totalPages > 1) {
        if (page > 1) keyboard.text('\u{2B05}\u{FE0F}', `supplier:orders:${page - 1}`);
        keyboard.text(`${page}/${totalPages}`, 'noop');
        if (page < totalPages) keyboard.text('\u{27A1}\u{FE0F}', `supplier:orders:${page + 1}`);
        keyboard.row();
      }
      keyboard.text('\u{1F519} Orqaga', 'supplier:summary');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Supplier orders error', error);
      await ctx.reply('Ma\'lumotlarni yuklashda xatolik yuz berdi.');
    }
  }

  async handlePayments(ctx: BotContext, page = 1): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);

      const supplier = await this.suppliersService.findSupplierByUserId(user.id, user);
      if (!supplier) {
        await ctx.reply('Sizga bog\'langan postavshik topilmadi.');
        return;
      }

      const debts = await this.suppliersService.findSupplierDebtsByFilter(user, {
        supplierId: supplier.id,
        isPaid: true,
        page,
        limit: 10,
      });

      let text = `\u{1F4B0} <b>OLINGAN PULLAR</b>\n\u{1F464} ${escapeHtml(supplier.name)}\n\n`;

      if (debts.data.length === 0) {
        text += `To'lovlar topilmadi.`;
      } else {
        let total = 0;
        for (const d of debts.data) {
          text += `\u{1F4B5} <b>${formatMoneyFull(d.amount)}</b>`;
          if (d.reason) text += ` \u{2014} ${escapeHtml(d.reason)}`;
          if (d.paidAt) text += `\n  \u{1F4C5} ${new Date(d.paidAt).toLocaleDateString('uz-UZ')}`;
          text += `\n\n`;
          total += d.amount;
        }
        text += `\u{1F4B0} <b>Jami:</b> ${formatMoneyFull(total)}`;
      }

      const keyboard = new InlineKeyboard();
      const totalPages = Math.ceil(debts.total / 10);
      if (totalPages > 1) {
        if (page > 1) keyboard.text('\u{2B05}\u{FE0F}', `supplier:payments:${page - 1}`);
        keyboard.text(`${page}/${totalPages}`, 'noop');
        if (page < totalPages) keyboard.text('\u{27A1}\u{FE0F}', `supplier:payments:${page + 1}`);
        keyboard.row();
      }
      keyboard.text('\u{1F519} Orqaga', 'supplier:summary');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Supplier payments error', error);
      await ctx.reply('Ma\'lumotlarni yuklashda xatolik yuz berdi.');
    }
  }
}
