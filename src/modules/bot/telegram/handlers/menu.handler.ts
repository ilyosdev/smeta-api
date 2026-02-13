import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard, Keyboard } from 'grammy';

import { UserRole } from 'src/common/database/schemas';
import { VendorUsersService } from 'src/modules/vendor/users/vendor-users.service';

import { BotContext } from '../types/context';
import { isAuthenticated, sessionToUser } from '../helpers/session-to-user';
import {
  buildMainMenu,
  getRoleLabel,
  TESTER_IDS,
  ALL_TESTABLE_ROLES,
} from '../keyboards/role-menu.keyboard';

const NO_PROJECT_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.OPERATOR, UserRole.WORKER];

/** Persistent reply keyboard — always visible at the bottom for all users */
export const MENU_REPLY_KEYBOARD = new Keyboard()
  .text('📋 Menyu').text('🏗️ Loyihalar').row()
  .text('❌ Bekor qilish').text('ℹ️ Yordam')
  .resized()
  .persistent();

@Injectable()
export class MenuHandler {
  private readonly logger = new Logger(MenuHandler.name);

  constructor(private readonly usersService: VendorUsersService) {}

  async showMainMenu(ctx: BotContext): Promise<void> {
    if (!ctx.session || !isAuthenticated(ctx.session)) {
      await ctx.reply('Avval tizimga kiring: /start', { reply_markup: MENU_REPLY_KEYBOARD });
      return;
    }

    const role = ctx.session.role as UserRole;
    const isTester = ctx.from?.id && TESTER_IDS.includes(String(ctx.from.id));

    // Testers must confirm role first
    if (isTester && !ctx.session.testerRoleConfirmed) {
      await this.showRoleSwitcher(ctx);
      return;
    }

    // If no project selected yet, show a hint but still show the menu
    if (!NO_PROJECT_ROLES.includes(role) && !ctx.session.selectedProjectId) {
      ctx.session.selectedProjectName = ctx.session.selectedProjectName || '';
    }

    const keyboard = buildMainMenu(role);

    // Testers get a role-switch button
    if (isTester) {
      keyboard.row().text('🧪 Rolni almashtirish', 'tester:switch_role');
    }

    const roleLabel = getRoleLabel(role);

    let text: string;
    if (NO_PROJECT_ROLES.includes(role)) {
      text =
        `👤 ${ctx.session.userName} (${roleLabel})\n\n` +
        'Amalni tanlang:';
    } else {
      text =
        `🏗️ ${ctx.session.selectedProjectName}\n` +
        `👤 ${ctx.session.userName} (${roleLabel})\n\n` +
        'Amalni tanlang:';
    }

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { reply_markup: keyboard });
    } else {
      // Send reply keyboard first to ensure persistent bottom buttons, then inline menu
      await ctx.reply(text, { reply_markup: keyboard });
    }
  }

  async showRoleSwitcher(ctx: BotContext): Promise<void> {
    const currentRole = ctx.session?.role as UserRole;
    const kb = new InlineKeyboard();

    for (const role of ALL_TESTABLE_ROLES) {
      const label = role === currentRole
        ? `✅ ${getRoleLabel(role)}`
        : getRoleLabel(role);
      kb.text(label, `tester:role:${role}`).row();
    }

    const text = '🧪 <b>TEST MODE</b>\n\nRolni tanlang:';

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  }

  async switchRole(ctx: BotContext, newRole: UserRole): Promise<void> {
    if (!ctx.session?.orgId) {
      await this.showMainMenu(ctx);
      return;
    }

    try {
      // Find a user with the selected role in the same organization
      const fakeUser = sessionToUser(ctx.session, ctx.from!.id);
      const result = await this.usersService.findAll({ role: newRole, limit: 50 }, fakeUser);

      if (result.data.length > 0) {
        // Prioritize user with matching name (e.g., "Haydovchi Dilmuhammad Org" for tester "Dilmuhammad")
        const testerName = ctx.session.userName?.toLowerCase() || '';
        let targetUser = result.data.find(u =>
          u.name.toLowerCase().includes(testerName) ||
          testerName.includes(u.name.toLowerCase().split(' ')[0])
        );

        // Fall back to first user if no name match
        if (!targetUser) {
          targetUser = result.data[0];
        }

        this.logger.log(`[switchRole] Before: userId=${ctx.session.userId}, role=${ctx.session.role}`);
        ctx.session.userId = targetUser.id;
        ctx.session.userName = targetUser.name;
        ctx.session.role = targetUser.role;
        this.logger.log(`[switchRole] After: userId=${ctx.session.userId}, role=${ctx.session.role}`);
        this.logger.log(`Tester switched to user: ${targetUser.name} (${targetUser.role})`);
      } else {
        // No user with this role - just change the role (original behavior)
        ctx.session.role = newRole;
        this.logger.warn(`No user found with role ${newRole}, only switching role flag`);
      }

      ctx.session.testerRoleConfirmed = true;
    } catch (error) {
      this.logger.error('Error switching role', error);
      ctx.session.role = newRole;
      ctx.session.testerRoleConfirmed = true;
    }

    await this.showMainMenu(ctx);
  }
}
