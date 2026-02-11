import { Context } from 'grammy';
import { BotContext, BotConversation } from '../types/context';
import { UserRole } from 'src/common/database/schemas';
import { buildMainMenu, getRoleLabel } from '../keyboards/role-menu.keyboard';

const CANCEL_COMMANDS = ['/cancel', 'bekor', '📋 menyu'];
const CANCEL_MSG = 'Bekor qilindi. ❌';
const CANCEL_CALLBACK = 'conv:cancel';

const NO_PROJECT_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.OPERATOR];

function isCancelText(text: string): boolean {
  return CANCEL_COMMANDS.includes(text.trim().toLowerCase());
}

/**
 * Send cancel message followed by the main menu.
 */
export async function replyCancelWithMenu(ctx: { reply: Context['reply']; session?: any }): Promise<void> {
  const role = ctx.session?.role as UserRole | undefined;
  if (role) {
    const keyboard = buildMainMenu(role);
    const roleLabel = getRoleLabel(role);
    let text: string;
    if (NO_PROJECT_ROLES.includes(role)) {
      text = `${CANCEL_MSG}\n\n👤 ${ctx.session.userName ?? ''} (${roleLabel})\n\nAmalni tanlang:`;
    } else {
      text =
        `${CANCEL_MSG}\n\n🏗️ ${ctx.session.selectedProjectName ?? ''}\n` +
        `👤 ${ctx.session.userName ?? ''} (${roleLabel})\n\nAmalni tanlang:`;
    }
    await ctx.reply(text, { reply_markup: keyboard });
  } else {
    await ctx.reply(CANCEL_MSG);
  }
}

/**
 * Wraps conversation.wait() to detect /cancel text or conv:cancel callback.
 * Returns the text string if user sent normal text.
 * Halts conversation if cancel detected — shows main menu before halting.
 */
export async function textWithCancel(
  conversation: BotConversation,
  ctx: BotContext,
  options?: { otherwise?: (ctx: BotContext) => unknown | Promise<unknown> },
): Promise<string> {
  for (;;) {
    const nextCtx = await conversation.wait();

    const text = nextCtx.message?.text;
    if (text && isCancelText(text)) {
      await replyCancelWithMenu(nextCtx as BotContext);
      await conversation.halt();
    }

    if (nextCtx.callbackQuery?.data === CANCEL_CALLBACK) {
      try { await nextCtx.answerCallbackQuery(); } catch {}
      await replyCancelWithMenu(nextCtx as BotContext);
      await conversation.halt();
    }

    if (text) return text;

    if (options?.otherwise) {
      await options.otherwise(nextCtx as BotContext);
    } else {
      await nextCtx.reply('Iltimos, matn kiriting (yoki /cancel):');
    }
  }
}

/**
 * Wraps conversation.wait() to detect callback matching pattern OR cancel.
 * Returns the context when a matching callback is received.
 * Halts conversation if cancel detected — shows main menu before halting.
 */
export async function waitForCallbackOrCancel(
  conversation: BotConversation,
  ctx: BotContext,
  pattern: RegExp,
  options?: { otherwise?: (ctx: BotContext) => unknown | Promise<unknown> },
): Promise<BotContext> {
  for (;;) {
    const nextCtx = await conversation.wait();

    const text = nextCtx.message?.text;
    if (text && isCancelText(text)) {
      await replyCancelWithMenu(nextCtx as BotContext);
      await conversation.halt();
    }

    if (nextCtx.callbackQuery?.data === CANCEL_CALLBACK) {
      try { await nextCtx.answerCallbackQuery(); } catch {}
      await replyCancelWithMenu(nextCtx as BotContext);
      await conversation.halt();
    }

    if (nextCtx.callbackQuery?.data && pattern.test(nextCtx.callbackQuery.data)) {
      return nextCtx as BotContext;
    }

    if (options?.otherwise) {
      await options.otherwise(nextCtx as BotContext);
    }
  }
}

/**
 * Check if a conversation.wait() result is a cancel command.
 * Use this for cases where you use conversation.wait() directly (e.g., AI branches).
 */
export function isCancel(ctx: Context): boolean {
  const text = ctx.message?.text;
  if (text && isCancelText(text)) return true;
  if (ctx.callbackQuery?.data === CANCEL_CALLBACK) return true;
  return false;
}
