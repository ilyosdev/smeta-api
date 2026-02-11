import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Bot, MemorySessionStorage, session } from 'grammy';
import { conversations } from '@grammyjs/conversations';

import { env } from 'src/common/config';
import { UserRole } from 'src/common/database/schemas';
import { BotAuthService } from '../auth/bot-auth.service';
import { VendorProjectsService } from 'src/modules/vendor/projects/vendor-projects.service';

import { BotContext } from './types/context';
import { SessionData } from './types/session';
import { isAuthenticated } from './helpers/session-to-user';
import { MENU_REPLY_KEYBOARD } from './handlers/menu.handler';
import { TESTER_IDS } from './keyboards/role-menu.keyboard';

import { StartHandler } from './handlers/start.handler';
import { ProjectHandler } from './handlers/project.handler';
import { MenuHandler } from './handlers/menu.handler';
import { BossMenu } from './menus/boss.menu';
import { AccountantMenu } from './menus/accountant.menu';
import { WarehouseMenu } from './menus/warehouse.menu';
import { SupplyMenu } from './menus/supply.menu';
import { ForemanMenu } from './menus/foreman.menu';
import { PtoMenu } from './menus/pto.menu';
import { DirekterMenu } from './menus/direktor.menu';
import { KassaMenu } from './menus/kassa.menu';
import { SuperAdminMenu } from './menus/super-admin.menu';
import { OperatorMenu } from './menus/operator.menu';
import { WorkerMenu } from './menus/worker.menu';
import { SupplierMenu } from './menus/supplier.menu';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Bot<BotContext>;

  constructor(
    private readonly authService: BotAuthService,
    private readonly projectsService: VendorProjectsService,
    private readonly startHandler: StartHandler,
    private readonly projectHandler: ProjectHandler,
    private readonly menuHandler: MenuHandler,
    private readonly bossMenu: BossMenu,
    private readonly accountantMenu: AccountantMenu,
    private readonly warehouseMenu: WarehouseMenu,
    private readonly supplyMenu: SupplyMenu,
    private readonly foremanMenu: ForemanMenu,
    private readonly ptoMenu: PtoMenu,
    private readonly direktorMenu: DirekterMenu,
    private readonly kassaMenu: KassaMenu,
    private readonly superAdminMenu: SuperAdminMenu,
    private readonly operatorMenu: OperatorMenu,
    private readonly workerMenu: WorkerMenu,
    private readonly supplierMenu: SupplierMenu,
  ) {}

  async onModuleInit(): Promise<void> {
    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set, bot will not start');
      return;
    }

    this.bot = new Bot<BotContext>(token);

    this.setupMiddleware();
    this.registerHandlers();

    // Set bot commands menu (visible in all chats including groups)
    await this.setBotCommands();

    if (env.NODE_ENV === 'dev') {
      await this.bot.api.deleteWebhook();
      this.bot.start({
        onStart: (botInfo) => {
          this.logger.log(`Bot started as @${botInfo.username} (long-polling)`);
        },
      });
    } else if (env.TELEGRAM_WEBHOOK_URL) {
      await this.bot.api.setWebhook(env.TELEGRAM_WEBHOOK_URL, {
        secret_token: env.TELEGRAM_WEBHOOK_SECRET || undefined,
      });
      this.logger.log(`Webhook set to ${env.TELEGRAM_WEBHOOK_URL}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.bot) {
      await this.bot.stop();
      this.logger.log('Bot stopped');
    }
  }

  getBot(): Bot<BotContext> {
    return this.bot;
  }

  // In-memory store for selected projects (survives grammY session issues)
  private projectStore = new Map<string, { projectId: string; projectName: string }>();

  setSelectedProject(telegramId: number, projectId: string, projectName: string): void {
    this.projectStore.set(String(telegramId), { projectId, projectName });
  }

  private async setBotCommands(): Promise<void> {
    const commands = [
      { command: 'start', description: 'Botni boshlash / Tizimga kirish' },
      { command: 'menu', description: 'Asosiy menyu' },
      { command: 'projects', description: 'Loyihalar ro\'yxati' },
      { command: 'cancel', description: 'Amalni bekor qilish' },
      { command: 'help', description: 'Yordam' },
    ];

    try {
      // Set commands for all private chats
      await this.bot.api.setMyCommands(commands, {
        scope: { type: 'all_private_chats' },
      });
      // Set commands for all group/supergroup chats
      await this.bot.api.setMyCommands(commands, {
        scope: { type: 'all_group_chats' },
      });
      this.logger.log('Bot commands set successfully');
    } catch (err) {
      this.logger.error('Failed to set bot commands', err);
    }
  }

  private setupMiddleware(): void {
    this.bot.use(
      session<SessionData, BotContext>({
        initial: (): SessionData => ({}),
        storage: new MemorySessionStorage<SessionData>(),
        getSessionKey: (ctx) => ctx.from?.id ? String(ctx.from.id) : undefined,
      }),
    );

    // Auto-restore session from DB + project store on every request
    this.bot.use(async (ctx, next) => {
      if (ctx.from?.id) {
        try {
          // Restore auth from DB
          const user = await this.authService.findByTelegramId(String(ctx.from.id));
          if (user && user.isActive) {
            ctx.session.userId = user.id;
            ctx.session.orgId = user.orgId;
            ctx.session.userName = user.name;
            ctx.session.phone = user.phone ?? undefined;
            // Don't overwrite tester's chosen role
            const isTester = TESTER_IDS.includes(String(ctx.from.id));
            if (!isTester || !ctx.session.testerRoleConfirmed) {
              ctx.session.role = user.role as UserRole;
            }

            // Restore selected project from project store
            const proj = this.projectStore.get(String(ctx.from.id));
            if (proj) {
              ctx.session.selectedProjectId = proj.projectId;
              ctx.session.selectedProjectName = proj.projectName;
            }

            // Auto-select first project if none chosen yet
            if (!ctx.session.selectedProjectId) {
              try {
                const iUser = { id: user.id, orgId: user.orgId, role: user.role as UserRole, name: user.name };
                const projects = await this.projectsService.findAll({ page: 1, limit: 1 }, iUser);
                if (projects.data.length > 0) {
                  const first = projects.data[0];
                  ctx.session.selectedProjectId = first.id;
                  ctx.session.selectedProjectName = first.name;
                  this.setSelectedProject(ctx.from.id, first.id, first.name);
                }
              } catch { /* no projects assigned */ }
            }
          }
        } catch {
          // User not found by telegramId — they need to /start
        }
      }
      await next();
    });

    this.bot.use(conversations());

    // Register conversation handlers
    for (const mw of this.accountantMenu.getConversationMiddleware()) {
      this.bot.use(mw);
    }
    for (const mw of this.warehouseMenu.getConversationMiddleware()) {
      this.bot.use(mw);
    }
    for (const mw of this.supplyMenu.getConversationMiddleware()) {
      this.bot.use(mw);
    }
    for (const mw of this.foremanMenu.getConversationMiddleware()) {
      this.bot.use(mw);
    }
    for (const mw of this.kassaMenu.getConversationMiddleware()) {
      this.bot.use(mw);
    }
    for (const mw of this.superAdminMenu.getConversationMiddleware()) {
      this.bot.use(mw);
    }
    for (const mw of this.operatorMenu.getConversationMiddleware()) {
      this.bot.use(mw);
    }

    this.bot.catch((err) => {
      this.logger.error(`Bot error: ${err.message}`, err.error);
      // Try to answer callback query if present (prevents stuck loading indicators)
      if (err.ctx?.callbackQuery) {
        err.ctx.answerCallbackQuery({ text: 'Xatolik yuz berdi' }).catch(() => {});
      }
    });
  }

  private registerHandlers(): void {
    // When bot is added to a group, send welcome message
    this.bot.on('my_chat_member', async (ctx) => {
      const chat = ctx.myChatMember.chat;
      const newStatus = ctx.myChatMember.new_chat_member.status;
      if (
        (chat.type === 'group' || chat.type === 'supergroup') &&
        (newStatus === 'member' || newStatus === 'administrator')
      ) {
        try {
          await ctx.api.sendMessage(
            chat.id,
            '🏗️ <b>Smeta Bot guruhga qo\'shildi!</b>\n\n' +
            'Buyruqlar:\n' +
            '/menu — Asosiy menyu\n' +
            '/projects — Loyihani tanlash\n' +
            '/help — Yordam',
            { parse_mode: 'HTML' },
          );
        } catch (err) {
          this.logger.error('Failed to send group welcome', err);
        }
      }
    });

    // Centralized auth + project guard for all role-specific callbacks
    const projectPrefixes = /^(boss|acc|supply|wh|foreman|pto|dir|exp|kassa):/;
    const authPrefixes = /^(boss|acc|supply|wh|foreman|pto|dir|exp|kassa|sa|op|worker|supplier|tester):/;

    this.bot.on('callback_query:data', async (ctx, next) => {
      const data = ctx.callbackQuery.data;
      const sess = ctx.session as SessionData | undefined;

      if (authPrefixes.test(data) && !isAuthenticated(sess)) {
        this.logger.warn(`CB guard BLOCKED (auth): data=${data}`);
        try { await ctx.answerCallbackQuery({ text: 'Avval tizimga kiring: /start' }); } catch {}
        return;
      }

      if (projectPrefixes.test(data) && !sess?.selectedProjectId) {
        // Log warning but don't block — middleware auto-selects, so this is an edge case
        this.logger.warn(`CB guard (no project): data=${data} — allowing through`);
      }

      await next();
    });

    // /start command
    this.bot.command('start', (ctx) => this.startHandler.handleStart(ctx));

    // Project selection callback
    this.bot.callbackQuery(/^project:/, async (ctx) => {
      await this.projectHandler.handleProjectSelect(ctx);
      if (ctx.session?.selectedProjectId && ctx.from?.id) {
        // Persist to project store for reliable retrieval
        this.setSelectedProject(ctx.from.id, ctx.session.selectedProjectId, ctx.session.selectedProjectName || '');
        await this.menuHandler.showMainMenu(ctx);
      }
    });

    // Switch project
    this.bot.callbackQuery('switch_project', async (ctx) => {
      if (ctx.session) {
        ctx.session.selectedProjectId = undefined;
        ctx.session.selectedProjectName = undefined;
      }
      if (ctx.from?.id) {
        this.projectStore.delete(String(ctx.from.id));
      }
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.projectHandler.showProjectList(ctx);
    });

    // Back to main menu
    this.bot.callbackQuery('main_menu', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.menuHandler.showMainMenu(ctx);
    });

    // Boss menu callbacks
    this.bot.callbackQuery('boss:dashboard', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.bossMenu.handleDashboard(ctx);
    });
    this.bot.callbackQuery('boss:debts', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.bossMenu.handleDebts(ctx);
    });
    this.bot.callbackQuery('boss:warehouse', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.bossMenu.handleWarehouse(ctx);
    });
    this.bot.callbackQuery('boss:pending', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.bossMenu.handlePending(ctx);
    });
    this.bot.callbackQuery(/^boss:ar:/, async (ctx) => {
      const id = ctx.callbackQuery.data.split(':')[2];
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.bossMenu.handleApproveRequest(ctx, id);
    });
    this.bot.callbackQuery(/^boss:rr:/, async (ctx) => {
      const id = ctx.callbackQuery.data.split(':')[2];
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.bossMenu.handleRejectRequest(ctx, id);
    });
    this.bot.callbackQuery(/^boss:ac:/, async (ctx) => {
      const id = ctx.callbackQuery.data.split(':')[2];
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.bossMenu.handleApproveCashRequest(ctx, id);
    });
    this.bot.callbackQuery(/^boss:rc:/, async (ctx) => {
      const id = ctx.callbackQuery.data.split(':')[2];
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.bossMenu.handleRejectCashRequest(ctx, id);
    });
    this.bot.callbackQuery(/^boss:ae:/, async (ctx) => {
      const id = ctx.callbackQuery.data.split(':')[2];
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.bossMenu.handleApproveExpense(ctx, id);
    });
    this.bot.callbackQuery(/^boss:re:/, async (ctx) => {
      const id = ctx.callbackQuery.data.split(':')[2];
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.bossMenu.handleRejectExpense(ctx, id);
    });

    // Common expense menu callbacks (kept for boss pending backward compat)
    this.bot.callbackQuery('exp:menu', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.bossMenu.handleExpenseMenu(ctx);
    });
    this.bot.callbackQuery('exp:add', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await ctx.conversation.enter('expense');
    });
    this.bot.callbackQuery('exp:view', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.bossMenu.handleExpenses(ctx);
    });

    // Kassa menu callbacks (unified for all roles)
    this.bot.callbackQuery('kassa:menu', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.kassaMenu.handleKassa(ctx);
    });
    this.bot.callbackQuery('kassa:balance', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.kassaMenu.handleBalance(ctx);
    });
    this.bot.callbackQuery('kassa:history', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.kassaMenu.handleHistory(ctx);
    });
    this.bot.callbackQuery('kassa:hist:week', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      await this.kassaMenu.handleHistoryFiltered(ctx, lastWeek, now);
    });
    this.bot.callbackQuery('kassa:hist:month', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      const now = new Date();
      const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      await this.kassaMenu.handleHistoryFiltered(ctx, lastMonth, now);
    });
    this.bot.callbackQuery('kassa:hist:custom', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.kassaMenu.handleDateCustom(ctx, 'history');
    });
    this.bot.callbackQuery('kassa:request', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.kassaMenu.handleRequestMoney(ctx);
    });
    this.bot.callbackQuery('kassa:expenses', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.kassaMenu.handleExpenses(ctx);
    });
    this.bot.callbackQuery('kassa:exp:week', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      await this.kassaMenu.handleExpensesFiltered(ctx, lastWeek, now);
    });
    this.bot.callbackQuery('kassa:exp:month', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      const now = new Date();
      const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      await this.kassaMenu.handleExpensesFiltered(ctx, lastMonth, now);
    });
    this.bot.callbackQuery('kassa:exp:custom', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.kassaMenu.handleDateCustom(ctx, 'expenses');
    });
    this.bot.callbackQuery('kassa:add_exp', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.kassaMenu.handleAddExpense(ctx);
    });

    // Super Admin callbacks
    this.bot.callbackQuery('sa:operators', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.superAdminMenu.handleOperators(ctx);
    });
    this.bot.callbackQuery('sa:companies', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.superAdminMenu.handleCompanies(ctx);
    });
    this.bot.callbackQuery('sa:settings', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.superAdminMenu.handleSettings(ctx);
    });
    this.bot.callbackQuery('sa:add_operator', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await ctx.conversation.enter('sa_add_operator');
    });
    this.bot.callbackQuery('sa:add_company', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await ctx.conversation.enter('sa_add_company');
    });

    // Operator callbacks
    this.bot.callbackQuery('op:companies', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.operatorMenu.handleCompanies(ctx);
    });
    this.bot.callbackQuery('op:projects', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.operatorMenu.handleProjects(ctx);
    });
    this.bot.callbackQuery('op:users', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.operatorMenu.handleUsers(ctx);
    });
    this.bot.callbackQuery('op:smeta_upload', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.operatorMenu.handleSmetaUpload(ctx);
    });
    this.bot.callbackQuery('op:add_project', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await ctx.conversation.enter('op_add_project');
    });
    this.bot.callbackQuery('op:add_user', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await ctx.conversation.enter('op_add_user');
    });
    this.bot.callbackQuery('op:assign_user', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await ctx.conversation.enter('op_assign_user');
    });
    this.bot.callbackQuery('op:add_company', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await ctx.conversation.enter('op_add_company');
    });

    // Accountant menu callbacks
    this.bot.callbackQuery('acc:income', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.accountantMenu.handleIncome(ctx);
    });
    this.bot.callbackQuery('acc:requests', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.accountantMenu.handleRequests(ctx);
    });
    this.bot.callbackQuery('acc:new_request', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.accountantMenu.handleNewRequest(ctx);
    });
    this.bot.callbackQuery(/^acc:approve_cash:/, async (ctx) => {
      const id = ctx.callbackQuery.data.split(':')[2];
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.accountantMenu.handleApproveCashRequest(ctx, id);
    });
    this.bot.callbackQuery(/^acc:reject_cash:/, async (ctx) => {
      const id = ctx.callbackQuery.data.split(':')[2];
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.accountantMenu.handleRejectCashRequest(ctx, id);
    });

    // Supply menu callbacks
    this.bot.callbackQuery('supply:new_order', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.supplyMenu.handleNewOrder(ctx);
    });
    this.bot.callbackQuery('supply:debt_menu', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.supplyMenu.handleDebtMenu(ctx);
    });
    this.bot.callbackQuery('supply:pay_debt', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.supplyMenu.handlePayDebt(ctx);
    });
    this.bot.callbackQuery('supply:debt_history', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.supplyMenu.handleDebtHistory(ctx);
    });
    this.bot.callbackQuery('supply:payments', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.supplyMenu.handlePayments(ctx);
    });
    this.bot.callbackQuery('supply:pay:week', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      await this.supplyMenu.handlePaymentsFiltered(ctx, lastWeek, now);
    });
    this.bot.callbackQuery('supply:pay:month', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      const now = new Date();
      const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      await this.supplyMenu.handlePaymentsFiltered(ctx, lastMonth, now);
    });

    // Warehouse menu callbacks
    this.bot.callbackQuery('wh:add', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.warehouseMenu.handleAdd(ctx);
    });
    this.bot.callbackQuery('wh:remove', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.warehouseMenu.handleRemove(ctx);
    });
    this.bot.callbackQuery('wh:transfer', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.warehouseMenu.handleTransfer(ctx);
    });
    this.bot.callbackQuery('wh:inventory', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.warehouseMenu.handleInventory(ctx);
    });

    // Foreman menu callbacks
    this.bot.callbackQuery('foreman:request_menu', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.foremanMenu.handleRequestMenu(ctx);
    });
    this.bot.callbackQuery('foreman:request', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.foremanMenu.handleRequest(ctx);
    });
    this.bot.callbackQuery(/^foreman:req_hist:/, async (ctx) => {
      const page = parseInt(ctx.callbackQuery.data.split(':')[2], 10) || 1;
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.foremanMenu.handleRequestHistory(ctx, page);
    });
    this.bot.callbackQuery('foreman:request_history', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.foremanMenu.handleRequestHistory(ctx);
    });
    this.bot.callbackQuery('foreman:workers', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.foremanMenu.handleWorkers(ctx);
    });
    this.bot.callbackQuery('foreman:worklog', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.foremanMenu.handleWorklog(ctx);
    });
    this.bot.callbackQuery('foreman:worker_volume', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.foremanMenu.handleWorkerVolume(ctx);
    });
    this.bot.callbackQuery('foreman:worker_pay', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.foremanMenu.handleWorkerPay(ctx);
    });
    this.bot.callbackQuery(/^foreman:pay_arch:/, async (ctx) => {
      const page = parseInt(ctx.callbackQuery.data.split(':')[2], 10) || 1;
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.foremanMenu.handlePaymentArchive(ctx, page);
    });
    this.bot.callbackQuery('foreman:payment_archive', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.foremanMenu.handlePaymentArchive(ctx);
    });
    this.bot.callbackQuery('foreman:register_worker', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.foremanMenu.handleRegisterWorker(ctx);
    });

    // Worker menu callbacks
    this.bot.callbackQuery('worker:summary', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.workerMenu.handleSummary(ctx);
    });
    this.bot.callbackQuery(/^worker:worklogs/, async (ctx) => {
      const parts = ctx.callbackQuery.data.split(':');
      const page = parts.length > 2 ? parseInt(parts[2], 10) : 1;
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.workerMenu.handleWorkLogs(ctx, page);
    });
    this.bot.callbackQuery(/^worker:payments/, async (ctx) => {
      const parts = ctx.callbackQuery.data.split(':');
      const page = parts.length > 2 ? parseInt(parts[2], 10) : 1;
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.workerMenu.handlePayments(ctx, page);
    });

    // PTO menu callbacks
    this.bot.callbackQuery('pto:progress', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.ptoMenu.handleProgress(ctx);
    });
    this.bot.callbackQuery('pto:comparison', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.ptoMenu.handleComparison(ctx);
    });
    this.bot.callbackQuery('pto:pending', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.ptoMenu.handlePending(ctx);
    });
    this.bot.callbackQuery(/^pto:approve_price:/, async (ctx) => {
      const workLogId = ctx.callbackQuery.data.split(':')[2];
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.ptoMenu.handleApproveWithPrice(ctx, workLogId);
    });
    this.bot.callbackQuery(/^pto:approve:/, async (ctx) => {
      const workLogId = ctx.callbackQuery.data.split(':')[2];
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.ptoMenu.handleApprove(ctx, workLogId);
    });
    this.bot.callbackQuery(/^pto:reject:/, async (ctx) => {
      const workLogId = ctx.callbackQuery.data.split(':')[2];
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.ptoMenu.handleReject(ctx, workLogId);
    });

    // Direktor menu callbacks
    this.bot.callbackQuery('dir:requests', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.direktorMenu.handleRequests(ctx);
    });
    this.bot.callbackQuery('dir:comparison', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.direktorMenu.handleComparison(ctx);
    });
    this.bot.callbackQuery('dir:pending', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.direktorMenu.handlePending(ctx);
    });
    this.bot.callbackQuery(/^dir:ar:/, async (ctx) => {
      const id = ctx.callbackQuery.data.split(':')[2];
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.direktorMenu.handleApproveRequest(ctx, id);
    });
    this.bot.callbackQuery(/^dir:rr:/, async (ctx) => {
      const id = ctx.callbackQuery.data.split(':')[2];
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.direktorMenu.handleRejectRequest(ctx, id);
    });
    // Register dir:approve_price BEFORE dir:approve (more specific regex first)
    this.bot.callbackQuery(/^dir:approve_price:/, async (ctx) => {
      const workLogId = ctx.callbackQuery.data.split(':')[2];
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.direktorMenu.handleApproveWithPrice(ctx, workLogId);
    });
    this.bot.callbackQuery(/^dir:approve:/, async (ctx) => {
      const workLogId = ctx.callbackQuery.data.split(':')[2];
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.direktorMenu.handleApprove(ctx, workLogId);
    });
    this.bot.callbackQuery(/^dir:reject:/, async (ctx) => {
      const workLogId = ctx.callbackQuery.data.split(':')[2];
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.direktorMenu.handleRejectWorkLog(ctx, workLogId);
    });

    // Supplier (Postavshik) menu callbacks
    this.bot.callbackQuery('supplier:summary', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.supplierMenu.handleSummary(ctx);
    });
    this.bot.callbackQuery(/^supplier:orders/, async (ctx) => {
      const parts = ctx.callbackQuery.data.split(':');
      const page = parts.length > 2 ? parseInt(parts[2], 10) : 1;
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.supplierMenu.handleOrders(ctx, page);
    });
    this.bot.callbackQuery(/^supplier:payments/, async (ctx) => {
      const parts = ctx.callbackQuery.data.split(':');
      const page = parts.length > 2 ? parseInt(parts[2], 10) : 1;
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.supplierMenu.handlePayments(ctx, page);
    });

    // Tester role switcher
    this.bot.callbackQuery('tester:switch_role', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
      await this.menuHandler.showRoleSwitcher(ctx);
    });
    this.bot.callbackQuery(/^tester:role:/, async (ctx) => {
      const newRole = ctx.callbackQuery.data.split(':')[2] as import('src/common/database/schemas').UserRole;
      try { await ctx.answerCallbackQuery({ text: `Rol: ${newRole}` }); } catch {}
      await this.menuHandler.switchRole(ctx, newRole);
    });

    // No-op callback (used for non-clickable buttons like page indicators)
    this.bot.callbackQuery('noop', async (ctx) => {
      try { await ctx.answerCallbackQuery(); } catch {}
    });

    // PTO / Direktor price input (for approve-with-price flow)
    this.bot.on('message:text', async (ctx, next) => {
      if (ctx.session?.ptoPendingApproveId) {
        await this.ptoMenu.handlePriceInput(ctx);
        return;
      }
      if (ctx.session?.dirPendingApproveId) {
        await this.direktorMenu.handlePriceInput(ctx);
        return;
      }
      await next();
    });

    // /cancel command - cancel and show main menu
    this.bot.command('cancel', (ctx) => this.menuHandler.showMainMenu(ctx));

    // /menu command - show main menu
    this.bot.command('menu', (ctx) => this.menuHandler.showMainMenu(ctx));

    // /projects command - show project list
    this.bot.command('projects', (ctx) => this.projectHandler.showProjectList(ctx));

    // /help command
    this.bot.command('help', (ctx) => this.sendHelp(ctx));

    // Reply keyboard button handlers (work in private chats + groups)
    this.bot.hears('📋 Menyu', (ctx) => this.menuHandler.showMainMenu(ctx));
    this.bot.hears('🏗️ Loyihalar', (ctx) => this.projectHandler.showProjectList(ctx));
    this.bot.hears('❌ Bekor qilish', (ctx) => this.menuHandler.showMainMenu(ctx));
    this.bot.hears('ℹ️ Yordam', (ctx) => this.sendHelp(ctx));
  }

  private async sendHelp(ctx: BotContext): Promise<void> {
    const text =
      '<b>Smeta Bot — Yordam</b>\n\n' +
      '📋 /menu — Asosiy menyu\n' +
      '🏗️ /projects — Loyihani tanlash\n' +
      '❌ /cancel — Amalni bekor qilish\n' +
      'ℹ️ /help — Shu yordam\n\n' +
      '<b>Qanday boshlash:</b>\n' +
      '1. Loyihani tanlang\n' +
      '2. Menyu orqali ishlang\n\n' +
      '<i>Savol bo\'lsa administrator bilan bog\'laning.</i>';

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: MENU_REPLY_KEYBOARD });
  }
}
