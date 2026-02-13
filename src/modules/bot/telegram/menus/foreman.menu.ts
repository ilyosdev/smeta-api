import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { createConversation } from '@grammyjs/conversations';
import { randomUUID } from 'crypto';

import { VendorWorkersService } from 'src/modules/vendor/workers/vendor-workers.service';
import { VendorRequestsService } from 'src/modules/vendor/requests/vendor-requests.service';
import { VendorSmetaItemsService } from 'src/modules/vendor/smeta-items/vendor-smeta-items.service';
import { VendorSmetasService } from 'src/modules/vendor/smetas/vendor-smetas.service';
import { AiService } from 'src/modules/bot/ai/ai.service';
import { BotAdminService } from 'src/modules/bot/admin/bot-admin.service';
import { BotAuthService } from 'src/modules/bot/auth/bot-auth.service';
import { UserRole } from 'src/common/database/schemas';
import { DataSource, SmetaItemCategory } from 'src/common/database/schemas/smeta-items';

import { BotContext, BotConversation } from '../types/context';
import { sessionToUser } from '../helpers/session-to-user';
import { formatMoneyFull, escapeHtml } from '../helpers/format';
import { waitForCallbackOrCancel } from '../helpers/cancel';
import { runSingleMessageFlow } from '../helpers/single-message-flow';
import {
  WORKLOG_FORM,
  FOREMAN_REQUEST_FORM,
} from '../helpers/form-configs';

@Injectable()
export class ForemanMenu {
  private readonly logger = new Logger(ForemanMenu.name);

  constructor(
    private readonly workersService: VendorWorkersService,
    private readonly requestsService: VendorRequestsService,
    private readonly smetaItemsService: VendorSmetaItemsService,
    private readonly smetasService: VendorSmetasService,
    private readonly aiService: AiService,
    private readonly adminService: BotAdminService,
    private readonly authService: BotAuthService,
  ) {}

  getConversationMiddleware() {
    return [
      createConversation(this.buildWorkLogConversation(), 'foreman_worklog'),
      createConversation(this.buildWorkerPayConversation(), 'foreman_worker_pay'),
      createConversation(this.buildRequestConversation(), 'foreman_request'),
      createConversation(this.buildRegisterWorkerConversation(), 'foreman_register_worker'),
    ];
  }

  // --- Menu handlers ---

  async handleRequestMenu(ctx: BotContext): Promise<void> {
    const text = `\u{1F4E6} <b>ZAYAVKA</b>\n\u{1F3D7}\u{FE0F} ${ctx.session?.selectedProjectName}\n\nAmalni tanlang:`;
    const keyboard = new InlineKeyboard()
      .text('\u{1F4E6} Zayavka qo\'shish', 'foreman:request').row()
      .text('\u{1F4CB} Zayavka tarixi', 'foreman:request_history').row()
      .text('\u{1F519} Menyu', 'main_menu');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  }

  async handleRequest(ctx: BotContext): Promise<void> {
    if (!ctx.session?.selectedProjectId) {
      await ctx.reply('Avval loyihani tanlang.');
      return;
    }
    await ctx.conversation.enter('foreman_request');
  }

  async handleRequestHistory(ctx: BotContext, index?: number): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const projectId = ctx.session?.selectedProjectId;

      const requests = await this.requestsService.findAll({ projectId, page: 1, limit: 100 }, user);

      // Cache IDs for navigation
      ctx.session.foremanReqHistIds = requests.data.map((r) => r.id);

      let text = `\u{1F4CB} <b>ZAYAVKA TARIXI</b>\n\u{1F3D7}\u{FE0F} ${ctx.session?.selectedProjectName}\n\n`;

      if (requests.data.length === 0) {
        text += `Zayavkalar topilmadi.`;
        const keyboard = new InlineKeyboard().text('\u{1F519} Orqaga', 'foreman:request_menu');
        if (ctx.callbackQuery) {
          await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
        } else {
          await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
        }
        return;
      }

      // Determine current index
      const currentIndex = index ?? ctx.session.foremanReqHistIndex ?? 0;
      const safeIndex = Math.max(0, Math.min(currentIndex, requests.data.length - 1));
      ctx.session.foremanReqHistIndex = safeIndex;

      const req = requests.data[safeIndex];
      const total = requests.data.length;

      const statusEmoji = req.status === 'PENDING' ? '\u{23F3}'
        : req.status === 'APPROVED' ? '\u{2705}'
        : req.status === 'REJECTED' ? '\u{274C}'
        : '\u{1F4E6}';
      const statusText = req.status === 'PENDING' ? 'Kutilmoqda'
        : req.status === 'APPROVED' ? 'Tasdiqlangan'
        : req.status === 'REJECTED' ? 'Rad etilgan'
        : req.status;
      const name = req.note || req.smetaItem?.name || 'Nomsiz';

      text += `${statusEmoji} <b>${escapeHtml(name)}</b>\n`;
      text += `   📊 Status: ${statusText}\n`;
      if (req.requestedQty) text += `   📦 Miqdor: ${req.requestedQty}`;
      if (req.smetaItem?.unit) text += ` ${escapeHtml(req.smetaItem.unit)}`;
      text += `\n`;
      text += `   \u{1F4C5} ${new Date(req.createdAt).toLocaleDateString('uz-UZ')}\n`;

      const keyboard = new InlineKeyboard();

      // Navigation row (only if more than 1 item)
      if (total > 1) {
        keyboard.text('◀️ Oldingi', 'foreman:req_hist_prev');
        keyboard.text(`${safeIndex + 1}/${total}`, 'noop');
        keyboard.text('Keyingi ▶️', 'foreman:req_hist_next');
        keyboard.row();
      }

      keyboard.text('\u{1F519} Orqaga', 'foreman:request_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Request history error', error);
      await ctx.reply('Ma\'lumotlarni yuklashda xatolik yuz berdi.');
    }
  }

  async handleReqHistPrev(ctx: BotContext): Promise<void> {
    const currentIndex = ctx.session?.foremanReqHistIndex ?? 0;
    const total = ctx.session?.foremanReqHistIds?.length ?? 0;
    const newIndex = currentIndex > 0 ? currentIndex - 1 : total - 1;
    await this.handleRequestHistory(ctx, newIndex);
  }

  async handleReqHistNext(ctx: BotContext): Promise<void> {
    const currentIndex = ctx.session?.foremanReqHistIndex ?? 0;
    const total = ctx.session?.foremanReqHistIds?.length ?? 0;
    const newIndex = currentIndex < total - 1 ? currentIndex + 1 : 0;
    await this.handleRequestHistory(ctx, newIndex);
  }

  async handleWorkers(ctx: BotContext): Promise<void> {
    const text = `\u{1F477} <b>USTALAR</b>\n\u{1F3D7}\u{FE0F} ${ctx.session?.selectedProjectName}\n\nAmalni tanlang:`;
    const keyboard = new InlineKeyboard()
      .text('\u{1F4D0} Ish hajmi', 'foreman:worker_volume').row()
      .text('\u{1F4B0} To\'lov qo\'shish', 'foreman:worker_pay').row()
      .text('\u{1F4CB} To\'lov arxivi', 'foreman:payment_archive').row()
      .text('\u{2795} Usta qo\'shish', 'foreman:register_worker').row()
      .text('\u{1F519} Menyu', 'main_menu');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  }

  async handleWorklog(ctx: BotContext): Promise<void> {
    if (!ctx.session?.selectedProjectId) {
      await ctx.reply('Avval loyihani tanlang.');
      return;
    }
    await ctx.conversation.enter('foreman_worklog');
  }

  async handleWorkerVolume(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const projectId = ctx.session?.selectedProjectId;

      // Show unpaid work logs — filtered at SQL level
      const unpaidResult = await this.workersService.findUnpaidWorkLogs(
        user, 1, 30, projectId,
      );

      let text = `\u{1F4D0} <b>ISH HAJMI</b>\n`;
      text += `\u{1F3D7}\u{FE0F} ${ctx.session?.selectedProjectName}\n\n`;

      if (unpaidResult.data.length === 0) {
        text += `To'lanmagan ishlar topilmadi.`;
      } else {
        for (const log of unpaidResult.data) {
          const workerName = log.worker?.name || 'Noma\'lum';
          const statusEmoji = log.isValidated ? '\u{2705}' : '\u{23F3}';
          text += `${statusEmoji} <b>${escapeHtml(workerName)}</b>\n`;
          text += `  ${escapeHtml(log.workType)}: ${log.quantity} ${escapeHtml(log.unit)}`;
          if (log.totalAmount) text += ` = ${formatMoneyFull(log.totalAmount)}`;
          text += `\n  \u{1F4C5} ${new Date(log.date).toLocaleDateString('uz-UZ')}\n`;
        }
        if (unpaidResult.total > 30) {
          text += `\n... jami ${unpaidResult.total} ta yozuv`;
        }
      }

      text += `\n\n\u{23F3} = tasdiqlanmagan, \u{2705} = tasdiqlangan (to'lanmagan)`;

      const keyboard = new InlineKeyboard()
        .text('\u{1F4D0} Yangi ish', 'foreman:worklog').row()
        .text('\u{1F519} Orqaga', 'foreman:workers');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Worker volume error', error);
      await ctx.reply('Ma\'lumotlarni yuklashda xatolik yuz berdi.');
    }
  }

  async handleWorkerPay(ctx: BotContext): Promise<void> {
    if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
    await ctx.conversation.enter('foreman_worker_pay');
  }

  async handleRegisterWorker(ctx: BotContext): Promise<void> {
    if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
    await ctx.conversation.enter('foreman_register_worker');
  }

  async handlePaymentArchive(ctx: BotContext, page = 1): Promise<void> {
    try {
      if (!ctx.session?.userId) { await ctx.reply('Avval tizimga kiring: /start'); return; }
      const user = sessionToUser(ctx.session, ctx.from!.id);

      const payments = await this.workersService.findAllPayments(user, page, 10);

      let text = `\u{1F4CB} <b>TO'LOV ARXIVI</b>\n\u{1F3D7}\u{FE0F} ${ctx.session?.selectedProjectName}\n\n`;

      if (payments.data.length === 0) {
        text += `To'lovlar topilmadi.`;
      } else {
        for (const p of payments.data) {
          text += `\u{1F4B5} <b>${formatMoneyFull(p.amount)}</b> \u{2014} ${escapeHtml(p.worker.name)}\n`;
          if (p.note) text += `  ${escapeHtml(p.note)}\n`;
          text += `  \u{1F4C5} ${new Date(p.createdAt).toLocaleDateString('uz-UZ')}\n\n`;
        }
      }

      const keyboard = new InlineKeyboard();
      const totalPages = Math.ceil(payments.total / 10);
      if (totalPages > 1) {
        if (page > 1) keyboard.text('\u{2B05}\u{FE0F}', `foreman:pay_arch:${page - 1}`);
        keyboard.text(`${page}/${totalPages}`, 'noop');
        if (page < totalPages) keyboard.text('\u{27A1}\u{FE0F}', `foreman:pay_arch:${page + 1}`);
        keyboard.row();
      }
      keyboard.text('\u{1F519} Orqaga', 'foreman:workers');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Payment archive error', error);
      await ctx.reply('Ma\'lumotlarni yuklashda xatolik yuz berdi.');
    }
  }

  // --- Conversation builders ---

  private buildWorkLogConversation() {
    const workersService = this.workersService;
    const smetaItemsService = this.smetaItemsService;
    const aiService = this.aiService;

    return async function foremanWorklog(
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

      // Single-message flow: workerName + workType + quantity + unit + unitPrice
      const result = await runSingleMessageFlow(
        conversation, ctx, WORKLOG_FORM, aiService,
        { projectName },
      );
      if (!result || !result.confirmed) return;

      const workerName: string | undefined = result.data.workerName;
      const workType = result.data.workType;
      const unit = result.data.unit || 'm\u00B2';
      const quantity = result.data.quantity;
      const unitPrice = result.data.unitPrice || 0;

      // Match worker by name
      let workerId: string | undefined;
      if (workerName) {
        const workers = await conversation.external(() =>
          workersService.findAllWorkers({ search: workerName }, user),
        );

        if (workers.data.length === 1) {
          workerId = workers.data[0].id;
        } else if (workers.data.length > 1) {
          // Multiple matches — let user pick
          const kb = new InlineKeyboard();
          for (const w of workers.data.slice(0, 10)) {
            kb.text(w.name, `selw:${w.id}`).row();
          }
          kb.text('\u{23E9} O\'tkazib yuborish', 'selw:skip');
          await ctx.reply('Qaysi usta?', { reply_markup: kb });
          const wCtx = await waitForCallbackOrCancel(conversation, ctx, /^selw:/);
          const selected = wCtx.callbackQuery!.data!.split(':')[1];
          try { await wCtx.answerCallbackQuery(); } catch {}
          workerId = selected === 'skip' ? undefined : selected;
        }
        // 0 matches — workerId stays undefined (anonymous)
      }

      try {
        await conversation.external(() =>
          workersService.createWorkLog(
            {
              projectId,
              workerId,
              workType,
              unit,
              quantity,
              unitPrice: unitPrice > 0 ? unitPrice : undefined,
            },
            user,
          ),
        );
        await ctx.reply('Bajarilgan ish muvaffaqiyatli yozildi! \u{2705}');

        // Smeta comparison warning
        try {
          const smetaList = await conversation.external(() =>
            smetaItemsService.findAll({ projectId, page: 1, limit: 50 }, user),
          );
          const match = smetaList.data.find((si) =>
            si.name.toLowerCase().includes(workType.toLowerCase()),
          );
          if (match) {
            const remaining = match.quantity - (match.usedQuantity || 0);
            if (quantity > remaining) {
              await ctx.reply(
                `\u{26A0}\u{FE0F} <b>ESLATMA:</b> Smetada ${remaining} ${escapeHtml(match.unit)} qolgan edi.\n` +
                `Siz ${quantity} ${escapeHtml(unit)} kiritdingiz.\n` +
                `Ortiqcha: +${(quantity - remaining).toFixed(1)} ${escapeHtml(unit)}`,
                { parse_mode: 'HTML' },
              );
            }
          }
        } catch { /* smeta check is non-critical */ }
      } catch {
        await ctx.reply('Saqlashda xatolik yuz berdi. \u{274C}');
      }
    };
  }

  private buildWorkerPayConversation() {
    const workersService = this.workersService;
    const aiService = this.aiService;

    return async function foremanWorkerPay(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const user = await conversation.external((ctx) =>
        sessionToUser(ctx.session, ctx.from!.id),
      );
      const projectId = await conversation.external((ctx) => ctx.session?.selectedProjectId);
      const projectName = await conversation.external((ctx) => ctx.session?.selectedProjectName || '');

      if (!projectId) {
        await ctx.reply('Avval loyihani tanlang: /projects');
        return;
      }

      // Step 1: Ask worker name
      await ctx.reply(
        '\u{1F4B0} <b>TO\'LOV QO\'SHISH</b>\n\u{1F3D7}\u{FE0F} ' + escapeHtml(projectName) + '\n\n' +
        'Usta ismini kiriting:\n\n' +
        '<i>/cancel - bekor qilish</i>',
        { parse_mode: 'HTML' },
      );

      let workerName = '';
      for (;;) {
        const nameCtx = await conversation.wait();
        if (nameCtx.message?.text === '/cancel') {
          await ctx.reply('Bekor qilindi.');
          return;
        }
        if (nameCtx.message?.text && nameCtx.message.text.trim().length >= 2) {
          workerName = nameCtx.message.text.trim();
          break;
        }
        await ctx.reply('Iltimos, usta ismini kiriting (kamida 2 belgi):');
      }

      // Step 2: Match worker
      const workers = await conversation.external(() =>
        workersService.findAllWorkers({ search: workerName }, user),
      );

      let workerId: string;
      let workerDisplayName = workerName;

      if (workers.data.length === 0) {
        await ctx.reply(`"${escapeHtml(workerName)}" nomli usta topilmadi. \u{274C}`, { parse_mode: 'HTML' });
        return;
      } else if (workers.data.length === 1) {
        workerId = workers.data[0].id;
        workerDisplayName = workers.data[0].name;
      } else {
        const kb = new InlineKeyboard();
        for (const w of workers.data.slice(0, 10)) {
          const debt = w.totalEarned - w.totalPaid;
          const label = `${w.name} (qarz: ${formatMoneyFull(Math.max(0, debt))})`;
          kb.text(label, `selw:${w.id}`).row();
        }
        kb.text('\u{274C} Bekor qilish', 'conv:cancel');
        await ctx.reply('Qaysi usta?', { reply_markup: kb });
        const wCtx = await waitForCallbackOrCancel(conversation, ctx, /^selw:/);
        workerId = wCtx.callbackQuery!.data!.split(':')[1];
        const selectedWorker = workers.data.find((w) => w.id === workerId);
        if (selectedWorker) workerDisplayName = selectedWorker.name;
        try { await wCtx.answerCallbackQuery(); } catch {}
      }

      // Step 3: Fetch validated unpaid work logs for this worker
      const unpaidResult = await conversation.external(() =>
        workersService.findValidatedUnpaidWorkLogs(user, workerId, projectId),
      );
      const unpaidLogs = unpaidResult.data;

      if (unpaidLogs.length === 0) {
        await ctx.reply(`${escapeHtml(workerDisplayName)} uchun to'lanmagan ish yo'q \u{2705}`, { parse_mode: 'HTML' });
        return;
      }

      // Step 4: Display unpaid work logs
      let text = `\u{1F4B0} <b>${escapeHtml(workerDisplayName)} \u{2014} To'lanmagan ishlar</b>\n\n`;
      let totalDebt = 0;
      const kb = new InlineKeyboard();

      for (const log of unpaidLogs.slice(0, 10)) {
        const amount = log.totalAmount || 0;
        totalDebt += amount;
        const dateStr = new Date(log.date).toLocaleDateString('uz-UZ');
        text += `\u{2705} ${escapeHtml(log.workType)}: ${log.quantity} ${escapeHtml(log.unit)}`;
        if (amount > 0) text += ` = ${formatMoneyFull(amount)}`;
        text += `\n  \u{1F4C5} ${dateStr}\n`;

        const btnLabel = `${log.workType} \u{2014} ${amount > 0 ? formatMoneyFull(amount) : '0'}`;
        kb.text(btnLabel, `paywork:${log.id}`).row();
      }

      text += `\n\u{1F4B0} <b>Jami qarz:</b> ${formatMoneyFull(totalDebt)}`;
      text += `\n\nQaysi ish uchun to'lov qilasiz?`;

      kb.text('\u{274C} Bekor qilish', 'conv:cancel');
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });

      // Step 5: Wait for work log selection
      const payCtx = await waitForCallbackOrCancel(conversation, ctx, /^paywork:/);
      try { await payCtx.answerCallbackQuery(); } catch {}
      const selectedLogId = payCtx.callbackQuery!.data!.split(':')[1];
      const selectedLog = unpaidLogs.find((l) => l.id === selectedLogId);

      if (!selectedLog) {
        await ctx.reply('Ish topilmadi. \u{274C}');
        return;
      }

      const suggestedAmount = selectedLog.totalAmount || 0;

      // Step 6: Ask amount (pre-filled suggestion)
      await ctx.reply(
        `To'lov summasi: <b>${formatMoneyFull(suggestedAmount)}</b>\n\n` +
        `Shu summani to'laysizmi? Boshqa summa kiriting yoki "ha" deb yozing:`,
        { parse_mode: 'HTML' },
      );

      let payAmount = suggestedAmount;
      for (;;) {
        const amtCtx = await conversation.wait();
        if (amtCtx.message?.text === '/cancel') {
          await ctx.reply('Bekor qilindi.');
          return;
        }
        const raw = amtCtx.message?.text?.trim().toLowerCase() || '';
        if (raw === 'ha' || raw === 'yes' || raw === 'ok') {
          break;
        }
        const parsed = Number(raw.replace(/[,\s_]/g, ''));
        if (!isNaN(parsed) && parsed > 0) {
          payAmount = parsed;
          break;
        }
        await ctx.reply('Iltimos, summani kiriting yoki "ha" deb yozing:');
      }

      // Step 7: Execute payment + mark as paid
      try {
        await conversation.external(() =>
          workersService.createPayment(
            { workerId, amount: payAmount, note: selectedLog.workType },
            user,
          ),
        );

        await conversation.external(() =>
          workersService.markWorkLogPaid(selectedLogId, user),
        );

        await ctx.reply(
          `\u{2705} To'lov amalga oshirildi!\n\n` +
          `\u{1F464} ${escapeHtml(workerDisplayName)}\n` +
          `\u{1F4B5} ${formatMoneyFull(payAmount)}\n` +
          `\u{1F4DD} ${escapeHtml(selectedLog.workType)}`,
          { parse_mode: 'HTML' },
        );
      } catch {
        await ctx.reply('To\'lovni saqlashda xatolik yuz berdi. \u{274C}');
      }
    };
  }

  private buildRequestConversation() {
    const requestsService = this.requestsService;
    const smetaItemsService = this.smetaItemsService;
    const smetasService = this.smetasService;
    const aiService = this.aiService;

    return async function foremanRequest(
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

      // Fetch smeta items for matching
      let smetaItemsList = await conversation.external(() =>
        smetaItemsService.findAll({ projectId, page: 1, limit: 100 }, user),
      );

      // If no smeta items exist, create a default smeta
      let smetaId: string | undefined;
      if (smetaItemsList.data.length === 0) {
        const newSmeta = await conversation.external(() =>
          smetasService.create(
            { projectId, name: 'Asosiy smeta', type: 'CONSTRUCTION' as any },
            user,
          ),
        );
        smetaId = newSmeta.id;
        await ctx.reply('Yangi smeta yaratildi. Davom eting.');
      } else {
        smetaId = smetaItemsList.data[0]?.smeta?.id;
      }

      // Main loop - allows adding multiple requests
      let continueAdding = true;
      while (continueAdding) {
        // Prompt for input
        await ctx.reply(
          `\u{1F4E6} <b>MATERIAL ZAYAVKASI</b>\n` +
          `\u{1F3D7}\u{FE0F} ${escapeHtml(projectName)}\n\n` +
          `Kerakli materiallarni yozing (bir nechta bo'lishi mumkin):\n` +
          `Masalan: "Sement 100 qop, armatura 500 kg, rozetka 20 dona"\n\n` +
          `\u{1F4DD} Matn, \u{1F399}\u{FE0F} ovoz yoki \u{1F4F8} rasm yuboring.\n` +
          `<i>/cancel - bekor qilish</i>`,
          { parse_mode: 'HTML' },
        );

        // Wait for input
        const inputCtx = await conversation.wait();
        if (inputCtx.message?.text?.toLowerCase() === '/cancel') {
          await ctx.reply('Bekor qilindi.');
          return;
        }

        // Extract items using AI or manual parsing
        let extractedItems: any[] = [];

        if (inputCtx.message?.voice && aiService.isAvailable()) {
          await ctx.reply('\u{1F399}\u{FE0F} Ovoz qayta ishlanmoqda...');
          try {
            const file = await inputCtx.getFile();
            const result = await conversation.external(async () => {
              const buffer = await aiService.downloadTelegramFile(file.file_path!);
              // Convert OGG to MP3 for Gemini
              const mp3Buffer = await aiService.convertOgaToMp3(buffer);
              return aiService.extractFromAudio(mp3Buffer, 'audio/mp3', 'foreman_request');
            });
            extractedItems = result?.items || [result];
          } catch {
            await ctx.reply('Ovozni qayta ishlashda xatolik. Matn yuboring.');
            continue;
          }
        } else if (inputCtx.message?.photo && aiService.isAvailable()) {
          await ctx.reply('\u{1F4F8} Rasm qayta ishlanmoqda...');
          try {
            const photos = inputCtx.message.photo;
            const photo = photos[photos.length - 1];
            const file = await inputCtx.api.getFile(photo.file_id);
            const result = await conversation.external(async () => {
              const buffer = await aiService.downloadTelegramFile(file.file_path!);
              return aiService.extractFromImage(buffer, 'image/jpeg', 'foreman_request');
            });
            extractedItems = result?.items || [result];
          } catch {
            await ctx.reply('Rasmni qayta ishlashda xatolik. Matn yuboring.');
            continue;
          }
        } else if (inputCtx.message?.text) {
          const text = inputCtx.message.text;
          console.log('[foremanRequest] Input text:', text);
          // Try AI extraction first, fall back to manual parsing
          if (aiService.isAvailable()) {
            try {
              const result = await conversation.external(() =>
                aiService.extractFromText(text, 'foreman_request'),
              );
              console.log('[foremanRequest] AI result:', JSON.stringify(result));
              extractedItems = result?.items || [result];
            } catch (err: any) {
              console.log('[foremanRequest] AI failed:', err?.message || err);
              // AI failed, use manual parsing
              extractedItems = parseRequestText(text);
            }
          } else {
            console.log('[foremanRequest] AI not available, using manual parsing');
            // AI not available, use manual parsing
            extractedItems = parseRequestText(text);
          }
          console.log('[foremanRequest] Extracted items:', JSON.stringify(extractedItems));
        } else {
          console.log('[foremanRequest] No text/voice/photo, continuing');
          continue;
        }

        // Helper function to parse request text manually
        function parseRequestText(text: string): any[] {
          const items: any[] = [];
          // Split by comma, newline, or semicolon
          const parts = text.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);
          for (const part of parts) {
            // Match: "Material 100 dona" or "100 dona Material" or "Material 100"
            const match = part.match(/^(.+?)\s+(\d+)\s*(\S+)?$/i)
              || part.match(/^(\d+)\s*(\S+)?\s+(.+)$/i);
            if (match) {
              const isQtyFirst = /^\d+/.test(match[1]);
              const name = isQtyFirst ? match[3] : match[1];
              const qty = isQtyFirst ? parseInt(match[1], 10) : parseInt(match[2], 10);
              const unit = isQtyFirst ? match[2] : match[3];
              if (name && qty) {
                items.push({
                  smetaItemName: name.trim(),
                  requestedQty: qty,
                  requestedUnit: unit?.trim() || 'dona',
                });
              }
            } else if (part.length > 2) {
              // Just material name without qty - default to 1
              items.push({
                smetaItemName: part,
                requestedQty: 1,
                requestedUnit: 'dona',
              });
            }
          }
          return items;
        }

        // Filter valid items
        console.log('[foremanRequest] Before filter:', JSON.stringify(extractedItems));
        extractedItems = extractedItems.filter(
          (item) => item && item.smetaItemName && item.requestedQty,
        );
        console.log('[foremanRequest] After filter:', JSON.stringify(extractedItems));

        if (extractedItems.length === 0) {
          await ctx.reply('Material topilmadi. Qaytadan urinib ko\'ring.');
          continue;
        }

        // Show ALL items in a single summary for confirmation
        let confirmationLoop = true;
        while (confirmationLoop) {
          let summary = `\u{1F4E6} <b>ZAYAVKALAR RO'YXATI</b>\n`;
          summary += `\u{1F3D7}\u{FE0F} ${escapeHtml(projectName)}\n\n`;

          extractedItems.forEach((item, index) => {
            summary += `<b>${index + 1}.</b> ${escapeHtml(item.smetaItemName)}\n`;
            summary += `   Miqdor: <b>${item.requestedQty} ${item.requestedUnit || 'dona'}</b>\n`;
            if (item.deadline) summary += `   Kerak: ${escapeHtml(item.deadline)}\n`;
            if (item.note) summary += `   Izoh: ${escapeHtml(item.note)}\n`;
            summary += '\n';
          });

          summary += `<b>Jami: ${extractedItems.length} ta zayavka</b>\n\n`;
          summary += `Barchasini tasdiqlaysizmi?`;

          const confirmKb = new InlineKeyboard()
            .text('\u{2705} Tasdiqlash', 'req:confirm_all')
            .text('\u{270F}\u{FE0F} Tahrirlash', 'req:edit_select')
            .row()
            .text('\u{274C} Bekor qilish', 'req:cancel_all');

          await ctx.reply(summary, { parse_mode: 'HTML', reply_markup: confirmKb });

          // Wait for confirmation
          const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, /^req:(confirm_all|edit_select|cancel_all)$/, {
            otherwise: (ctx) => ctx.reply('Iltimos, tugmalardan birini bosing.'),
          });
          try { await confirmCtx.answerCallbackQuery(); } catch {}
          const action = confirmCtx.callbackQuery!.data;
          console.log('[foremanRequest] Confirmation action:', action);

          if (action === 'req:cancel_all') {
            await ctx.reply('Barcha zayavkalar bekor qilindi.');
            confirmationLoop = false;
            continue;
          }

          if (action === 'req:edit_select') {
            // Show list of items to edit
            const editKb = new InlineKeyboard();
            extractedItems.forEach((item, index) => {
              editKb.text(`${index + 1}. ${item.smetaItemName}`, `req:edit_item:${index}`).row();
            });
            editKb.text('\u{1F519} Orqaga', 'req:back_to_confirm');

            await ctx.reply('Qaysi zayavkani tahrirlash yoki o\'chirish?', { reply_markup: editKb });

            const editSelectCtx = await waitForCallbackOrCancel(conversation, ctx, /^req:(edit_item:\d+|back_to_confirm)$/, {
              otherwise: (ctx) => ctx.reply('Iltimos, tugmalardan birini bosing.'),
            });
            try { await editSelectCtx.answerCallbackQuery(); } catch {}
            const editAction = editSelectCtx.callbackQuery!.data;

            if (!editAction || editAction === 'req:back_to_confirm') {
              continue; // Go back to confirmation
            }

            const editIndex = parseInt(editAction!.split(':')[2], 10);
            const itemToEdit = extractedItems[editIndex];

            if (!itemToEdit) continue;

            // Show edit options for this item
            const itemEditKb = new InlineKeyboard()
              .text('\u{270F}\u{FE0F} Miqdorni o\'zgartirish', `req:change_qty:${editIndex}`)
              .row()
              .text('\u{1F5D1}\u{FE0F} O\'chirish', `req:delete_item:${editIndex}`)
              .row()
              .text('\u{1F519} Orqaga', 'req:back_to_edit_list');

            await ctx.reply(
              `\u{1F4E6} <b>${escapeHtml(itemToEdit.smetaItemName)}</b>\n` +
              `Miqdor: ${itemToEdit.requestedQty} ${itemToEdit.requestedUnit || 'dona'}\n\n` +
              `Nima qilmoqchisiz?`,
              { parse_mode: 'HTML', reply_markup: itemEditKb },
            );

            const itemActionCtx = await waitForCallbackOrCancel(conversation, ctx, /^req:(change_qty:\d+|delete_item:\d+|back_to_edit_list)$/, {
              otherwise: (ctx) => ctx.reply('Iltimos, tugmalardan birini bosing.'),
            });
            try { await itemActionCtx.answerCallbackQuery(); } catch {}
            const itemAction = itemActionCtx.callbackQuery!.data;

            if (!itemAction || itemAction === 'req:back_to_edit_list') {
              continue;
            }

            if (itemAction!.startsWith('req:delete_item:')) {
              const deleteIndex = parseInt(itemAction!.split(':')[2], 10);
              const deletedItem = extractedItems.splice(deleteIndex, 1)[0];
              await ctx.reply(`"${deletedItem.smetaItemName}" o'chirildi.`);

              if (extractedItems.length === 0) {
                await ctx.reply('Barcha zayavkalar o\'chirildi.');
                confirmationLoop = false;
              }
              continue;
            }

            if (itemAction!.startsWith('req:change_qty:')) {
              const qtyIndex = parseInt(itemAction!.split(':')[2], 10);
              await ctx.reply(`Yangi miqdorni kiriting (masalan: 50 dona):`);

              const qtyCtx = await conversation.wait();
              if (qtyCtx.message?.text && qtyCtx.message.text !== '/cancel') {
                const match = qtyCtx.message.text.match(/(\d+)\s*(\w+)?/);
                if (match) {
                  extractedItems[qtyIndex].requestedQty = parseInt(match[1], 10);
                  if (match[2]) extractedItems[qtyIndex].requestedUnit = match[2];
                  await ctx.reply(`Miqdor yangilandi: ${extractedItems[qtyIndex].requestedQty} ${extractedItems[qtyIndex].requestedUnit || 'dona'}`);
                }
              }
              continue;
            }
          }

          if (action === 'req:confirm_all') {
            // Save all requests with same batchId if multiple items
            const batchId = extractedItems.length > 1 ? randomUUID() : undefined;
            let savedCount = 0;
            for (const item of extractedItems) {
              // Find or create smeta item
              const inputName = (item.smetaItemName || '').toLowerCase().trim();
              let matched = smetaItemsList.data.find(
                (si) => si.name.toLowerCase() === inputName ||
                  si.name.toLowerCase().includes(inputName) ||
                  inputName.includes(si.name.toLowerCase()),
              );

              if (!matched && smetaId) {
                // Create new smeta item
                matched = await conversation.external(() =>
                  smetaItemsService.create(
                    {
                      smetaId: smetaId!,
                      name: item.smetaItemName,
                      category: 'Boshqa',
                      unit: item.requestedUnit || 'dona',
                      quantity: 0,
                      unitPrice: 0,
                      itemType: SmetaItemCategory.MATERIAL,
                      source: DataSource.TELEGRAM,
                    },
                    user,
                  ),
                );
                // Refresh smeta items list
                smetaItemsList = await conversation.external(() =>
                  smetaItemsService.findAll({ projectId, page: 1, limit: 100 }, user),
                );
              }

              if (matched) {
                const noteParts = [
                  item.note,
                  item.deadline ? `Kerak: ${item.deadline}` : '',
                ].filter(Boolean);

                await conversation.external(() =>
                  requestsService.create(
                    {
                      batchId,
                      smetaItemId: matched!.id,
                      requestedQty: item.requestedQty,
                      requestedAmount: 0,
                      note: noteParts.join(' | ') || `${matched!.name} kerak`,
                      source: DataSource.TELEGRAM,
                    },
                    user,
                  ),
                );
                savedCount++;
              }
            }

            if (savedCount > 0) {
              await ctx.reply(`\u{2705} ${savedCount} ta zayavka yuborildi!`);
            }
            confirmationLoop = false;
          }
        }

        // Ask if want to add more
        const moreKb = new InlineKeyboard()
          .text('\u{2795} Yana qo\'shish', 'req:more')
          .text('\u{1F3E0} Menyu', 'req:done');

        await ctx.reply('Yana zayavka qo\'shmoqchimisiz?', { reply_markup: moreKb });

        const moreCtx = await waitForCallbackOrCancel(conversation, ctx, /^req:(more|done)$/, {
          otherwise: (ctx) => ctx.reply('Iltimos, tugmalardan birini bosing.'),
        });
        try { await moreCtx.answerCallbackQuery(); } catch {}
        continueAdding = moreCtx.callbackQuery!.data === 'req:more';
      }
    };
  }

  private buildRegisterWorkerConversation() {
    const adminService = this.adminService;
    const authService = this.authService;
    const workersService = this.workersService;

    return async function foremanRegisterWorker(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const user = await conversation.external((ctx) =>
        sessionToUser(ctx.session, ctx.from!.id),
      );
      const projectId = await conversation.external((ctx) => ctx.session?.selectedProjectId);

      // Step 1: Ask for name
      await ctx.reply(
        '\u{1F477} <b>ISHCHI QO\'SHISH</b>\n\n' +
        'Ishchi ism-familiyasini kiriting:\n\n' +
        '<i>/cancel - bekor qilish</i>',
        { parse_mode: 'HTML' },
      );

      let name = '';
      for (;;) {
        const nameCtx = await conversation.wait();
        if (nameCtx.message?.text === '/cancel') {
          await ctx.reply('Bekor qilindi.');
          return;
        }
        if (nameCtx.message?.text && nameCtx.message.text.trim().length >= 2) {
          name = nameCtx.message.text.trim();
          break;
        }
        await ctx.reply('Iltimos, ism-familiyani kiriting (kamida 2 belgi):');
      }

      // Step 2: Ask for phone
      await ctx.reply(
        'Telefon raqamini kiriting:\n' +
        'Format: <code>+998901234567</code>',
        { parse_mode: 'HTML' },
      );

      let phone = '';
      for (;;) {
        const phoneCtx = await conversation.wait();
        if (phoneCtx.message?.text === '/cancel') {
          await ctx.reply('Bekor qilindi.');
          return;
        }
        if (phoneCtx.message?.text) {
          let raw = phoneCtx.message.text.trim().replace(/[\s\-\(\)]/g, '');
          if (!raw.startsWith('+')) raw = '+' + raw;

          if (!/^\+\d{9,15}$/.test(raw)) {
            await ctx.reply('Noto\'g\'ri format. Masalan: +998901234567');
            continue;
          }

          // Check if phone already registered
          const existing = await conversation.external(() =>
            authService.findByPhone(raw),
          );
          if (existing) {
            await ctx.reply('Bu telefon raqam allaqachon tizimda ro\'yxatdan o\'tgan! Boshqa raqam kiriting:');
            continue;
          }

          phone = raw;
          break;
        }
        await ctx.reply('Iltimos, telefon raqamini kiriting:');
      }

      // Step 3: Confirmation
      const confirmKb = new InlineKeyboard()
        .text('\u{2705} Tasdiqlash', 'regw:confirm')
        .text('\u{274C} Bekor qilish', 'regw:cancel');

      await ctx.reply(
        '\u{1F477} <b>ISHCHI QO\'SHISH</b>\n\n' +
        `\u{1F464} Ism: <b>${escapeHtml(name)}</b>\n` +
        `\u{1F4F1} Tel: <b>${escapeHtml(phone)}</b>\n\n` +
        'Tasdiqlaysizmi?',
        { parse_mode: 'HTML', reply_markup: confirmKb },
      );

      const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, /^regw:/);
      try { await confirmCtx.answerCallbackQuery(); } catch {}
      const action = confirmCtx.callbackQuery!.data!.split(':')[1];

      if (action === 'cancel') {
        await ctx.reply('Bekor qilindi.');
        return;
      }

      // Step 4: Create user + worker
      try {
        const newUser = await conversation.external(() =>
          adminService.createUser(name, phone, UserRole.WORKER, user.orgId),
        );

        // Assign to PRORAB's current project
        if (projectId) {
          await conversation.external(() =>
            adminService.assignUserToProject(newUser.id, projectId),
          );
        }

        // Create worker entity linked to user
        await conversation.external(() =>
          workersService.createWorker(
            { name, phone, userId: newUser.id } as any,
            user,
          ),
        );

        await ctx.reply(
          '\u{2705} Ishchi muvaffaqiyatli ro\'yxatga olindi!\n\n' +
          `\u{1F464} ${escapeHtml(name)}\n` +
          `\u{1F4F1} ${escapeHtml(phone)}\n\n` +
          `Ishchi endi botga kirishi mumkin:\n` +
          `1. Bot ga /start buyrug'ini yuboring\n` +
          `2. Telefon raqamni ulashing\n` +
          `3. Hisob-kitobni ko'ring`,
          { parse_mode: 'HTML' },
        );
      } catch (err: any) {
        console.error('[registerWorker] Error:', err?.message || err);
        await ctx.reply('Ishchini ro\'yxatga olishda xatolik yuz berdi. \u{274C}');
      }
    };
  }

}
