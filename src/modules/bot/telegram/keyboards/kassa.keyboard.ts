import { InlineKeyboard } from 'grammy';
import { UserRole } from 'src/common/database/schemas';

export function buildKassaMenu(role?: UserRole): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text('💰 Balans', 'kassa:balance').row()
    .text('📋 Koshelok tarixi', 'kassa:history').row();

  if (role !== UserRole.BUGALTERIYA) {
    kb.text('💵 Pul so\'rash', 'kassa:request').row();
  }

  kb.text('📋 Rasxod ko\'rish', 'kassa:expenses').row()
    .text('➕ Rasxod qo\'shish', 'kassa:add_exp').row();

  kb.text('🔙 Menyu', 'main_menu');
  return kb;
}

export function buildDateFilterKeyboard(prefix: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('📅 Oxirgi hafta', `${prefix}:week`).row()
    .text('📅 Oxirgi oy', `${prefix}:month`).row()
    .text('📅 Boshqa (tanlash)', `${prefix}:custom`).row()
    .text('🔙 Kassa', 'kassa:menu');
}
