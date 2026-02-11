import { InlineKeyboard } from 'grammy';

export function paginationKeyboard(
  prefix: string,
  page: number,
  totalPages: number,
  backCallback?: string,
): InlineKeyboard {
  const kb = new InlineKeyboard();

  if (totalPages > 1) {
    if (page > 1) {
      kb.text('⬅️', `${prefix}:page:${page - 1}`);
    }
    kb.text(`${page}/${totalPages}`, 'noop');
    if (page < totalPages) {
      kb.text('➡️', `${prefix}:page:${page + 1}`);
    }
    kb.row();
  }

  if (backCallback) {
    kb.text('🔙 Orqaga', backCallback);
  }

  return kb;
}
