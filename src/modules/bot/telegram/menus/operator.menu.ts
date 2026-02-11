import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { createConversation } from '@grammyjs/conversations';
import * as XLSX from 'xlsx';

import { VendorUsersService } from 'src/modules/vendor/users/vendor-users.service';
import { VendorProjectsService } from 'src/modules/vendor/projects/vendor-projects.service';
import { VendorSmetasService } from 'src/modules/vendor/smetas/vendor-smetas.service';
import { VendorSmetaItemsService } from 'src/modules/vendor/smeta-items/vendor-smeta-items.service';
import { BotAdminService } from '../../admin/bot-admin.service';
import { UserRole, SmetaType } from 'src/common/database/schemas';
import { SmetaItemCategory, DataSource } from 'src/common/database/schemas/smeta-items';
import { env } from 'src/common/config';

import { BotContext, BotConversation } from '../types/context';
import { sessionToUser } from '../helpers/session-to-user';
import { escapeHtml, formatMoneyFull, parseNumber } from '../helpers/format';
import { buildConfirmationKeyboard } from '../keyboards/confirmation.keyboard';
import { getRoleLabel } from '../keyboards/role-menu.keyboard';
import { textWithCancel, waitForCallbackOrCancel } from '../helpers/cancel';

const OP_ASSIGNABLE_ROLES: UserRole[] = [
  UserRole.BOSS,
  UserRole.DIREKTOR,
  UserRole.BUGALTERIYA,
  UserRole.PTO,
  UserRole.SNABJENIYA,
  UserRole.SKLAD,
  UserRole.PRORAB,
  UserRole.WORKER,
];

@Injectable()
export class OperatorMenu {
  private readonly logger = new Logger(OperatorMenu.name);

  constructor(
    private readonly usersService: VendorUsersService,
    private readonly projectsService: VendorProjectsService,
    private readonly smetasService: VendorSmetasService,
    private readonly smetaItemsService: VendorSmetaItemsService,
    private readonly adminService: BotAdminService,
  ) {}

  getConversationMiddleware() {
    return [
      createConversation(this.buildAddProjectConversation(), 'op_add_project'),
      createConversation(this.buildAddUserConversation(), 'op_add_user'),
      createConversation(this.buildAssignUserConversation(), 'op_assign_user'),
      createConversation(this.buildSmetaUploadConversation(), 'op_smeta_upload'),
      createConversation(this.buildAddCompanyConversation(), 'op_add_company'),
    ];
  }

  // --- Multi-org company list ---

  async handleCompanies(ctx: BotContext): Promise<void> {
    try {
      const result = await this.adminService.listOrganizations(1, 20);

      let text = `🏢 <b>KOMPANIYALAR</b>\n\n`;

      if (result.data.length === 0) {
        text += `Kompaniyalar yo'q.\n`;
      } else {
        for (const org of result.data) {
          text += `🏢 <b>${escapeHtml(org.name)}</b>\n`;
          text += `  📱 ${escapeHtml(org.phone || 'N/A')}\n`;
          text += `  👥 ${org.userCount} ta foydalanuvchi | 📁 ${org.projectCount} ta loyiha\n`;
          text += `  ${org.isActive ? '✅ Faol' : '❌ Nofaol'}\n\n`;
        }
        text += `Jami: ${result.total} ta kompaniya`;
      }

      const keyboard = new InlineKeyboard()
        .text('➕ Kompaniya qo\'shish', 'op:add_company').row()
        .text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Error listing companies', error);
      await ctx.reply('Kompaniyalarni yuklashda xatolik yuz berdi.');
    }
  }

  // --- Projects grouped by company ---

  async handleProjects(ctx: BotContext): Promise<void> {
    try {
      const orgs = await this.adminService.listOrganizations(1, 20);

      let text = `📁 <b>LOYIHALAR</b>\n\n`;

      if (orgs.data.length === 0) {
        text += `Kompaniyalar topilmadi. Avval kompaniya qo'shing.\n`;
      } else {
        const statusLabels: Record<string, string> = {
          PLANNING: '📝',
          ACTIVE: '✅',
          ON_HOLD: '⏸️',
          COMPLETED: '🏁',
        };
        let totalProjects = 0;
        for (const org of orgs.data) {
          const projects = await this.adminService.listProjects(org.id, 1, 50);
          text += `🏢 <b>${escapeHtml(org.name)}</b>\n`;
          if (projects.data.length === 0) {
            text += `  Loyihalar yo'q.\n\n`;
          } else {
            for (const p of projects.data) {
              text += `  ${statusLabels[p.status] || ''} ${escapeHtml(p.name)}`;
              if (p.budget) text += ` (${formatMoneyFull(p.budget)})`;
              text += `\n`;
            }
            text += `\n`;
            totalProjects += projects.data.length;
          }
        }
        text += `Jami: ${totalProjects} ta loyiha`;
      }

      const keyboard = new InlineKeyboard()
        .text('➕ Loyiha qo\'shish', 'op:add_project').row()
        .text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Error listing projects', error);
      await ctx.reply('Loyihalarni yuklashda xatolik yuz berdi.');
    }
  }

  // --- Users grouped by company ---

  async handleUsers(ctx: BotContext): Promise<void> {
    try {
      const orgs = await this.adminService.listOrganizations(1, 20);

      let text = `👥 <b>FOYDALANUVCHILAR</b>\n\n`;

      if (orgs.data.length === 0) {
        text += `Kompaniyalar topilmadi.\n`;
      } else {
        let totalUsers = 0;
        for (const org of orgs.data) {
          const users = await this.adminService.listUsers(org.id, 1, 50);
          text += `🏢 <b>${escapeHtml(org.name)}</b>\n`;
          if (users.data.length === 0) {
            text += `  Foydalanuvchilar yo'q.\n\n`;
          } else {
            for (const u of users.data) {
              text += `  👤 <b>${escapeHtml(u.name)}</b> — ${getRoleLabel(u.role as UserRole)}\n`;
              text += `     📱 ${escapeHtml(u.phone || 'N/A')} ${u.isActive ? '✅' : '❌'}\n`;
            }
            text += `\n`;
            totalUsers += users.data.length;
          }
        }
        text += `Jami: ${totalUsers} ta foydalanuvchi`;
      }

      const keyboard = new InlineKeyboard()
        .text('➕ Foydalanuvchi qo\'shish', 'op:add_user').row()
        .text('🔗 Loyihaga biriktirish', 'op:assign_user').row()
        .text('🔙 Menyu', 'main_menu');

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Error listing users', error);
      await ctx.reply('Foydalanuvchilarni yuklashda xatolik yuz berdi.');
    }
  }

  async handleSmetaUpload(ctx: BotContext): Promise<void> {
    await ctx.conversation.enter('op_smeta_upload');
  }

  // --- Conversations ---

  private buildAddCompanyConversation() {
    const adminService = this.adminService;

    return async function opAddCompany(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      await ctx.reply(
        '🏢 <b>KOMPANIYA QO\'SHISH</b>\n\nKompaniya nomini kiriting:\n\n<i>/cancel - bekor qilish</i>',
        { parse_mode: 'HTML' },
      );
      const name = await textWithCancel(conversation, ctx);

      await ctx.reply('Telefon raqamini kiriting (yoki `-` o\'tkazish):');
      const phoneText = await textWithCancel(conversation, ctx);
      const phone = phoneText === '-' ? undefined : phoneText;

      let summary = `🏢 <b>KOMPANIYA QO'SHILSIN?</b>\n\n`;
      summary += `🏢 Nom: ${escapeHtml(name)}\n`;
      if (phone) summary += `📱 Telefon: ${escapeHtml(phone)}\n`;

      await ctx.reply(summary, {
        parse_mode: 'HTML',
        reply_markup: buildConfirmationKeyboard('opcomp', { withEdit: false }),
      });

      const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, /^opcomp:(confirm|cancel)/, {
        otherwise: (ctx) => ctx.reply('Iltimos, tasdiqlang yoki bekor qiling.'),
      });
      try { await confirmCtx.answerCallbackQuery(); } catch {}

      if (confirmCtx.callbackQuery!.data! === 'opcomp:cancel') {
        await ctx.reply('Bekor qilindi. ❌');
        return;
      }

      try {
        const org = await conversation.external(() =>
          adminService.createOrganization(name, phone),
        );
        await ctx.reply(
          `✅ Kompaniya muvaffaqiyatli qo'shildi!\n\n🏢 ${escapeHtml(org.name)}`,
          { parse_mode: 'HTML' },
        );
      } catch {
        await ctx.reply('Kompaniyani saqlashda xatolik yuz berdi. ❌');
      }
    };
  }

  private buildAddProjectConversation() {
    const adminService = this.adminService;

    return async function opAddProject(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      // Step 1: Select organization
      const orgs = await conversation.external(() =>
        adminService.listOrganizations(1, 50),
      );

      if (orgs.data.length === 0) {
        await ctx.reply('Avval kompaniya qo\'shing.');
        return;
      }

      const orgKb = new InlineKeyboard();
      for (const org of orgs.data) {
        orgKb.text(org.name, `seloporg:${org.id}`).row();
      }
      await ctx.reply(
        '🏗️ <b>LOYIHA QO\'SHISH</b>\n\nQaysi kompaniyaga loyiha qo\'shmoqchisiz?\n\n<i>/cancel - bekor qilish</i>',
        { parse_mode: 'HTML', reply_markup: orgKb },
      );

      const orgCtx = await waitForCallbackOrCancel(conversation, ctx, /^seloporg:/, {
        otherwise: (ctx) => ctx.reply('Iltimos, kompaniyani tanlang.'),
      });
      const selectedOrgId = orgCtx.callbackQuery!.data!.split(':')[1];
      const selectedOrgName = orgs.data.find((o) => o.id === selectedOrgId)?.name || '';
      try { await orgCtx.answerCallbackQuery(); } catch {}

      // Step 2: Project name
      await ctx.reply(`🏢 ${escapeHtml(selectedOrgName)}\n\nLoyiha nomini kiriting:`, {
        parse_mode: 'HTML',
      });
      const name = await textWithCancel(conversation, ctx);

      // Step 3: Address
      await ctx.reply('Manzilni kiriting (yoki `-` o\'tkazish):');
      const addressText = await textWithCancel(conversation, ctx);
      const address = addressText === '-' ? undefined : addressText;

      // Step 4: Floors
      await ctx.reply('Qavatlar sonini kiriting (yoki `-` o\'tkazish):');
      const floorsText = await textWithCancel(conversation, ctx);
      const floors = floorsText === '-' ? undefined : (parseNumber(floorsText) || undefined);

      // Step 5: Budget
      await ctx.reply('Byudjet so\'mda kiriting (yoki `-` o\'tkazish):');
      const budgetText = await textWithCancel(conversation, ctx);
      const budget = budgetText === '-' ? undefined : (parseNumber(budgetText) || undefined);

      // Step 6: Confirmation
      let summary = `🏗️ <b>LOYIHA QO'SHILSIN?</b>\n\n`;
      summary += `🏢 Kompaniya: ${escapeHtml(selectedOrgName)}\n`;
      summary += `🏗️ Nom: ${escapeHtml(name)}\n`;
      if (address) summary += `📍 Manzil: ${escapeHtml(address)}\n`;
      if (floors) summary += `🏢 Qavatlar: ${floors}\n`;
      if (budget) summary += `💰 Byudjet: ${formatMoneyFull(budget)}\n`;

      await ctx.reply(summary, {
        parse_mode: 'HTML',
        reply_markup: buildConfirmationKeyboard('opproj', { withEdit: false }),
      });

      const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, /^opproj:(confirm|cancel)/, {
        otherwise: (ctx) => ctx.reply('Iltimos, tasdiqlang yoki bekor qiling.'),
      });
      try { await confirmCtx.answerCallbackQuery(); } catch {}

      if (confirmCtx.callbackQuery!.data! === 'opproj:cancel') {
        await ctx.reply('Bekor qilindi. ❌');
        return;
      }

      try {
        const project = await conversation.external(() =>
          adminService.createProjectForOrg(selectedOrgId, { name, address, floors, budget }),
        );
        await ctx.reply(
          `✅ Loyiha muvaffaqiyatli qo'shildi!\n\n🏢 ${escapeHtml(selectedOrgName)}\n🏗️ ${escapeHtml(project.name)}`,
          { parse_mode: 'HTML' },
        );
      } catch {
        await ctx.reply('Loyihani saqlashda xatolik yuz berdi. ❌');
      }
    };
  }

  private buildAddUserConversation() {
    const adminService = this.adminService;

    return async function opAddUser(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      // Step 1: Select organization
      const orgs = await conversation.external(() =>
        adminService.listOrganizations(1, 50),
      );

      if (orgs.data.length === 0) {
        await ctx.reply('Avval kompaniya qo\'shing.');
        return;
      }

      const orgKb = new InlineKeyboard();
      for (const org of orgs.data) {
        orgKb.text(org.name, `seluserorg:${org.id}`).row();
      }
      await ctx.reply(
        '👤 <b>FOYDALANUVCHI QO\'SHISH</b>\n\nQaysi kompaniyaga qo\'shmoqchisiz?\n\n<i>/cancel - bekor qilish</i>',
        { parse_mode: 'HTML', reply_markup: orgKb },
      );

      const orgCtx = await waitForCallbackOrCancel(conversation, ctx, /^seluserorg:/, {
        otherwise: (ctx) => ctx.reply('Iltimos, kompaniyani tanlang.'),
      });
      const selectedOrgId = orgCtx.callbackQuery!.data!.split(':')[1];
      const selectedOrgName = orgs.data.find((o) => o.id === selectedOrgId)?.name || '';
      try { await orgCtx.answerCallbackQuery(); } catch {}

      // Step 2: Name
      await ctx.reply(`🏢 ${escapeHtml(selectedOrgName)}\n\nFoydalanuvchi ismini kiriting:`, {
        parse_mode: 'HTML',
      });
      const name = await textWithCancel(conversation, ctx);

      // Step 3: Phone
      await ctx.reply('Telefon raqamini kiriting (+998...):');
      const phone = await textWithCancel(conversation, ctx);

      // Step 4: Role selection
      const roleKb = new InlineKeyboard();
      for (const role of OP_ASSIGNABLE_ROLES) {
        roleKb.text(getRoleLabel(role), `selrole:${role}`).row();
      }
      await ctx.reply('Rolni tanlang:', { reply_markup: roleKb });

      const roleCtx = await waitForCallbackOrCancel(conversation, ctx, /^selrole:/, {
        otherwise: (ctx) => ctx.reply('Iltimos, rolni tanlang.'),
      });
      const selectedRole = roleCtx.callbackQuery!.data!.split(':')[1] as UserRole;
      try { await roleCtx.answerCallbackQuery(); } catch {}

      // Step 5: Optional project assignment
      let selectedProjectId: string | undefined;
      let selectedProjectName: string | undefined;

      const projects = await conversation.external(() =>
        adminService.listProjects(selectedOrgId, 1, 50),
      );

      if (projects.data.length > 0) {
        const projKb = new InlineKeyboard();
        for (const p of projects.data) {
          projKb.text(p.name, `selproj:${p.id}`).row();
        }
        projKb.text('⏩ O\'tkazish', 'selproj:skip').row();
        await ctx.reply('Loyihaga biriktirish (ixtiyoriy):', { reply_markup: projKb });

        const projCtx = await waitForCallbackOrCancel(conversation, ctx, /^selproj:/, {
          otherwise: (ctx) => ctx.reply('Iltimos, loyihani tanlang yoki o\'tkazing.'),
        });
        const projData = projCtx.callbackQuery!.data!.split(':')[1];
        try { await projCtx.answerCallbackQuery(); } catch {}

        if (projData !== 'skip') {
          selectedProjectId = projData;
          selectedProjectName = projects.data.find((p) => p.id === projData)?.name;
        }
      }

      // Step 6: Confirmation
      let summary = `👤 <b>FOYDALANUVCHI QO'SHILSIN?</b>\n\n`;
      summary += `🏢 Kompaniya: ${escapeHtml(selectedOrgName)}\n`;
      summary += `👤 Ism: ${escapeHtml(name)}\n`;
      summary += `📱 Telefon: ${escapeHtml(phone)}\n`;
      summary += `🏷️ Rol: ${getRoleLabel(selectedRole)}\n`;
      if (selectedProjectName) summary += `🏗️ Loyiha: ${escapeHtml(selectedProjectName)}\n`;

      await ctx.reply(summary, {
        parse_mode: 'HTML',
        reply_markup: buildConfirmationKeyboard('opuser', { withEdit: false }),
      });

      const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, /^opuser:(confirm|cancel)/, {
        otherwise: (ctx) => ctx.reply('Iltimos, tasdiqlang yoki bekor qiling.'),
      });
      try { await confirmCtx.answerCallbackQuery(); } catch {}

      if (confirmCtx.callbackQuery!.data! === 'opuser:cancel') {
        await ctx.reply('Bekor qilindi. ❌');
        return;
      }

      try {
        const newUser = await conversation.external(() =>
          adminService.createUser(name, phone, selectedRole, selectedOrgId),
        );

        if (selectedProjectId) {
          await conversation.external(() =>
            adminService.assignUserToProject(newUser.id, selectedProjectId!),
          );
        }

        let msg = `✅ Foydalanuvchi muvaffaqiyatli qo'shildi!\n\n`;
        msg += `🏢 ${escapeHtml(selectedOrgName)}\n`;
        msg += `👤 ${escapeHtml(newUser.name)} — ${getRoleLabel(selectedRole)}`;
        if (selectedProjectName) msg += `\n🏗️ ${escapeHtml(selectedProjectName)}`;
        await ctx.reply(msg, { parse_mode: 'HTML' });
      } catch {
        await ctx.reply('Foydalanuvchini saqlashda xatolik yuz berdi. ❌');
      }
    };
  }

  private buildAssignUserConversation() {
    const adminService = this.adminService;

    return async function opAssignUser(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      // Step 1: Select org
      const orgs = await conversation.external(() =>
        adminService.listOrganizations(1, 50),
      );

      if (orgs.data.length === 0) {
        await ctx.reply('Kompaniyalar topilmadi.');
        return;
      }

      const orgKb = new InlineKeyboard();
      for (const org of orgs.data) {
        orgKb.text(org.name, `selassignorg:${org.id}`).row();
      }
      await ctx.reply(
        '🔗 <b>LOYIHAGA BIRIKTIRISH</b>\n\nKompaniyani tanlang:\n\n<i>/cancel - bekor qilish</i>',
        { parse_mode: 'HTML', reply_markup: orgKb },
      );

      const orgCtx = await waitForCallbackOrCancel(conversation, ctx, /^selassignorg:/, {
        otherwise: (ctx) => ctx.reply('Iltimos, kompaniyani tanlang.'),
      });
      const selectedOrgId = orgCtx.callbackQuery!.data!.split(':')[1];
      try { await orgCtx.answerCallbackQuery(); } catch {}

      // Step 2: Select user from that org
      const users = await conversation.external(() =>
        adminService.listUsers(selectedOrgId, 1, 50),
      );

      if (users.data.length === 0) {
        await ctx.reply('Foydalanuvchilar topilmadi. Avval foydalanuvchi qo\'shing.');
        return;
      }

      const userKb = new InlineKeyboard();
      for (const u of users.data) {
        userKb.text(`${u.name} (${getRoleLabel(u.role as UserRole)})`, `selusr:${u.id}`).row();
      }
      await ctx.reply('Foydalanuvchini tanlang:', { reply_markup: userKb });

      const usrCtx = await waitForCallbackOrCancel(conversation, ctx, /^selusr:/, {
        otherwise: (ctx) => ctx.reply('Iltimos, foydalanuvchini tanlang.'),
      });
      const selectedUserId = usrCtx.callbackQuery!.data!.split(':')[1];
      const selectedUserName = users.data.find((u) => u.id === selectedUserId)?.name || '';
      try { await usrCtx.answerCallbackQuery(); } catch {}

      // Step 3: Select project from that org
      const projects = await conversation.external(() =>
        adminService.listProjects(selectedOrgId, 1, 50),
      );

      if (projects.data.length === 0) {
        await ctx.reply('Loyihalar topilmadi. Avval loyiha qo\'shing.');
        return;
      }

      const projKb = new InlineKeyboard();
      for (const p of projects.data) {
        projKb.text(p.name, `selprojassign:${p.id}`).row();
      }
      await ctx.reply('Loyihani tanlang:', { reply_markup: projKb });

      const projCtx = await waitForCallbackOrCancel(conversation, ctx, /^selprojassign:/, {
        otherwise: (ctx) => ctx.reply('Iltimos, loyihani tanlang.'),
      });
      const selectedProjectId = projCtx.callbackQuery!.data!.split(':')[1];
      const selectedProjectName = projects.data.find((p) => p.id === selectedProjectId)?.name || '';
      try { await projCtx.answerCallbackQuery(); } catch {}

      // Confirmation
      const summary =
        `🔗 <b>BIRIKTIRISH TASDIQLANSIN?</b>\n\n` +
        `👤 ${escapeHtml(selectedUserName)}\n` +
        `🏗️ ${escapeHtml(selectedProjectName)}\n`;

      await ctx.reply(summary, {
        parse_mode: 'HTML',
        reply_markup: buildConfirmationKeyboard('opassign', { withEdit: false }),
      });

      const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, /^opassign:(confirm|cancel)/, {
        otherwise: (ctx) => ctx.reply('Iltimos, tasdiqlang yoki bekor qiling.'),
      });
      try { await confirmCtx.answerCallbackQuery(); } catch {}

      if (confirmCtx.callbackQuery!.data! === 'opassign:cancel') {
        await ctx.reply('Bekor qilindi. ❌');
        return;
      }

      try {
        await conversation.external(() =>
          adminService.assignUserToProject(selectedUserId, selectedProjectId),
        );
        await ctx.reply(
          `✅ Muvaffaqiyatli biriktirildi!\n\n` +
          `👤 ${escapeHtml(selectedUserName)} → 🏗️ ${escapeHtml(selectedProjectName)}`,
          { parse_mode: 'HTML' },
        );
      } catch {
        await ctx.reply('Biriktirishda xatolik yuz berdi. ❌');
      }
    };
  }

  private buildSmetaUploadConversation() {
    const adminService = this.adminService;
    const smetasService = this.smetasService;
    const smetaItemsService = this.smetaItemsService;
    const logger = this.logger;

    return async function opSmetaUpload(
      conversation: BotConversation,
      ctx: BotContext,
    ) {
      const user = await conversation.external((ctx) =>
        sessionToUser(ctx.session, ctx.from!.id),
      );

      // Step 1: Select org
      const orgs = await conversation.external(() =>
        adminService.listOrganizations(1, 50),
      );

      if (orgs.data.length === 0) {
        await ctx.reply('Kompaniyalar topilmadi.');
        return;
      }

      const orgKb = new InlineKeyboard();
      for (const org of orgs.data) {
        orgKb.text(org.name, `selsmetaorg:${org.id}`).row();
      }
      await ctx.reply(
        '📐 <b>SMETA YUKLASH</b>\n\nKompaniyani tanlang:\n\n<i>/cancel - bekor qilish</i>',
        { parse_mode: 'HTML', reply_markup: orgKb },
      );

      const orgCtx = await waitForCallbackOrCancel(conversation, ctx, /^selsmetaorg:/, {
        otherwise: (ctx) => ctx.reply('Iltimos, kompaniyani tanlang.'),
      });
      const selectedOrgId = orgCtx.callbackQuery!.data!.split(':')[1];
      try { await orgCtx.answerCallbackQuery(); } catch {}

      // Step 2: Select project from that org
      const projects = await conversation.external(() =>
        adminService.listProjects(selectedOrgId, 1, 50),
      );

      if (projects.data.length === 0) {
        await ctx.reply('Loyihalar topilmadi. Avval loyiha qo\'shing.');
        return;
      }

      const projKb = new InlineKeyboard();
      for (const p of projects.data) {
        projKb.text(p.name, `selprojsmeta:${p.id}`).row();
      }
      await ctx.reply('Loyihani tanlang:', { reply_markup: projKb });

      const projCtx = await waitForCallbackOrCancel(conversation, ctx, /^selprojsmeta:/, {
        otherwise: (ctx) => ctx.reply('Iltimos, loyihani tanlang.'),
      });
      const projectId = projCtx.callbackQuery!.data!.split(':')[1];
      const projectName = projects.data.find((p) => p.id === projectId)?.name || '';
      try { await projCtx.answerCallbackQuery(); } catch {}

      await ctx.reply(`🏗️ ${escapeHtml(projectName)}\n\nSmeta nomini kiriting:`, {
        parse_mode: 'HTML',
      });
      const smetaName = await textWithCancel(conversation, ctx);

      // Smeta type selection
      const typeKb = new InlineKeyboard()
        .text('🏗️ Qurilish', `seltype:${SmetaType.CONSTRUCTION}`).row()
        .text('⚡ Elektr', `seltype:${SmetaType.ELECTRICAL}`).row()
        .text('🔧 Santexnika', `seltype:${SmetaType.PLUMBING}`).row()
        .text('❄️ HVAC', `seltype:${SmetaType.HVAC}`).row()
        .text('🎨 Pardozlash', `seltype:${SmetaType.FINISHING}`).row()
        .text('📦 Boshqa', `seltype:${SmetaType.OTHER}`).row();
      await ctx.reply('Smeta turini tanlang:', { reply_markup: typeKb });

      const typeCtx = await waitForCallbackOrCancel(conversation, ctx, /^seltype:/, {
        otherwise: (ctx) => ctx.reply('Iltimos, turini tanlang.'),
      });
      const smetaType = typeCtx.callbackQuery!.data!.split(':')[1] as SmetaType;
      try { await typeCtx.answerCallbackQuery(); } catch {}

      await ctx.reply(
        'Excel faylni yuboring (.xlsx yoki .xls):\n\n' +
        '<i>Fayl formati:\nHar bir qator: Nomi | Birligi | Miqdori | Narxi\n\n/cancel - bekor qilish</i>',
        { parse_mode: 'HTML' },
      );

      // Wait for document
      const docCtx = await conversation.waitFor('message:document', {
        otherwise: (ctx) => ctx.reply('Iltimos, Excel fayl yuboring (yoki /cancel).'),
      });

      const doc = docCtx.message?.document;
      if (!doc) {
        await ctx.reply('Fayl topilmadi. ❌');
        return;
      }

      const fileName = doc.file_name || '';
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        await ctx.reply('Faqat .xlsx yoki .xls fayllar qabul qilinadi. ❌');
        return;
      }

      await ctx.reply('⏳ Fayl yuklanmoqda va tahlil qilinmoqda...');

      try {
        // Download file
        const file = await conversation.external(() =>
          docCtx.api.getFile(doc.file_id),
        );
        const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

        const response = await conversation.external(async () => {
          const res = await fetch(fileUrl);
          return Buffer.from(await res.arrayBuffer());
        });

        // Parse Excel
        const workbook = XLSX.read(response, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length < 2) {
          await ctx.reply('Faylda ma\'lumotlar topilmadi (kamida 2 qator kerak: sarlavha + ma\'lumot). ❌');
          return;
        }

        // Create smeta
        const smeta = await conversation.external(() =>
          smetasService.create({ projectId, name: smetaName, type: smetaType }, user),
        );

        // Parse rows (skip header)
        let created = 0;
        let skipped = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 4) {
            skipped++;
            continue;
          }

          const itemName = String(row[0] || '').trim();
          const unit = String(row[1] || '').trim();
          const quantity = parseFloat(row[2]) || 0;
          const unitPrice = parseFloat(row[3]) || 0;

          if (!itemName || !unit || quantity <= 0 || unitPrice <= 0) {
            skipped++;
            continue;
          }

          const categoryRaw = row.length > 4 ? String(row[4] || '').trim().toUpperCase() : '';
          let itemType = SmetaItemCategory.MATERIAL;
          if (categoryRaw === 'WORK' || categoryRaw === 'ISH') itemType = SmetaItemCategory.WORK;
          else if (categoryRaw === 'MACHINE' || categoryRaw === 'MEXANIZM') itemType = SmetaItemCategory.MACHINE;
          else if (categoryRaw === 'OTHER' || categoryRaw === 'BOSHQA') itemType = SmetaItemCategory.OTHER;

          try {
            await conversation.external(() =>
              smetaItemsService.create(
                {
                  smetaId: smeta.id,
                  itemType,
                  category: itemType,
                  name: itemName,
                  unit,
                  quantity,
                  unitPrice,
                  source: DataSource.TELEGRAM,
                },
                user,
              ),
            );
            created++;
          } catch (err) {
            logger.error(`Failed to create smeta item row ${i}`, err);
            skipped++;
          }
        }

        await ctx.reply(
          `✅ <b>SMETA YUKLANDI!</b>\n\n` +
          `🏗️ Loyiha: ${escapeHtml(projectName)}\n` +
          `📐 Smeta: ${escapeHtml(smetaName)}\n` +
          `📊 Yuklangan: ${created} ta element\n` +
          (skipped > 0 ? `⚠️ O'tkazilgan: ${skipped} ta qator\n` : ''),
          { parse_mode: 'HTML' },
        );
      } catch (error) {
        logger.error('Smeta upload error', error);
        await ctx.reply('Faylni yuklashda xatolik yuz berdi. ❌\n\nFayl formatini tekshiring.');
      }
    };
  }
}
