import { InlineKeyboard } from 'grammy';

export function buildConfirmationKeyboard(prefix: string, options?: { withEdit?: boolean }): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text('✅ Tasdiqlash', `${prefix}:confirm`);
  if (options?.withEdit !== false) {
    kb.text('✏️ Tahrirlash', `${prefix}:edit`);
  }
  kb.text('❌ Bekor qilish', `${prefix}:cancel`);
  return kb;
}

export function buildCancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('❌ Bekor qilish', 'conv:cancel');
}
