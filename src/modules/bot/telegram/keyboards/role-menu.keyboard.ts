import { InlineKeyboard } from 'grammy';
import { UserRole } from 'src/common/database/schemas';

/** Telegram IDs allowed to switch roles for testing */
export const TESTER_IDS = ['5513718576', '6651698857'];

export const ALL_TESTABLE_ROLES: UserRole[] = [
  UserRole.BOSS,
  UserRole.DIREKTOR,
  UserRole.BUGALTERIYA,
  UserRole.PTO,
  UserRole.SNABJENIYA,
  UserRole.SKLAD,
  UserRole.PRORAB,
  UserRole.WORKER,
  UserRole.POSTAVSHIK,
];

export function buildMainMenu(role: UserRole): InlineKeyboard {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return buildSuperAdminMenu();
    case UserRole.OPERATOR:
      return buildOperatorMenu();
    case UserRole.BOSS:
      return buildBossMenu();
    case UserRole.DIREKTOR:
      return buildDirektorMenu();
    case UserRole.BUGALTERIYA:
      return buildAccountantMenu();
    case UserRole.SNABJENIYA:
      return buildSupplyMenu();
    case UserRole.SKLAD:
      return buildWarehouseMenu();
    case UserRole.PRORAB:
      return buildForemanMenu();
    case UserRole.PTO:
      return buildPtoMenu();
    case UserRole.WORKER:
      return buildWorkerMenu();
    case UserRole.POSTAVSHIK:
      return buildSupplierMenu();
    default:
      return buildBossMenu();
  }
}

function buildSuperAdminMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('👤 Operatorlar', 'sa:operators').row()
    .text('🏢 Kompaniyalar', 'sa:companies').row()
    .text('⚙️ Tizim sozlamalari', 'sa:settings');
}

function buildOperatorMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🏢 Kompaniyalar', 'op:companies').row()
    .text('📁 Loyihalar', 'op:projects').row()
    .text('👥 Foydalanuvchilar', 'op:users').row()
    .text('📐 Smeta yuklash', 'op:smeta_upload');
}

function buildBossMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📊 Statistika', 'boss:dashboard').row()
    .text('💰 Qarzlar', 'boss:debts').row()
    .text('🏬 Sklad', 'boss:warehouse').row()
    .text('💵 Kassa', 'kassa:menu').row()
    .text('🔄 Loyihani almashtirish', 'switch_project');
}

function buildAccountantMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('💰 Kirim', 'acc:income').row()
    .text('📋 Zayavkalar', 'acc:requests').row()
    .text('💵 Kassa', 'kassa:menu').row()
    .text('🔄 Loyihani almashtirish', 'switch_project');
}

function buildSupplyMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📦 Buyurtma berish', 'supply:new_order').row()
    .text('💰 Qarz to\'lash', 'supply:debt_menu').row()
    .text('💵 Koshelok', 'kassa:menu').row()
    .text('🔄 Loyihani almashtirish', 'switch_project');
}

function buildWarehouseMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('➕ Mahsulot qo\'shish', 'wh:add').row()
    .text('➖ Mahsulot chiqim', 'wh:remove').row()
    .text('🔄 Ko\'chirish', 'wh:transfer').row()
    .text('📋 Ombor', 'wh:inventory').row()
    .text('💵 Kassa', 'kassa:menu').row()
    .text('🔄 Loyihani almashtirish', 'switch_project');
}

function buildForemanMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📦 Zayavka', 'foreman:request_menu').row()
    .text('💵 Koshelok', 'kassa:menu').row()
    .text('👷 Ustalar', 'foreman:workers').row()
    .text('🔄 Loyihani almashtirish', 'switch_project');
}

function buildSupplierMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📊 Hisob-kitob', 'supplier:summary').row()
    .text('📦 Berilgan tovar', 'supplier:orders').row()
    .text('💰 Olingan pullar', 'supplier:payments');
}

function buildWorkerMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📊 Hisob-kitob', 'worker:summary').row()
    .text('📐 Bajarilgan ishlar', 'worker:worklogs').row()
    .text('💰 To\'lovlar', 'worker:payments');
}

function buildDirektorMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📦 Zayavkalar', 'dir:requests').row()
    .text('📐 Smeta vs Fakt', 'dir:comparison').row()
    .text('✅ Tasdiqlash', 'dir:pending').row()
    .text('💵 Kassa', 'kassa:menu').row()
    .text('🔄 Loyihani almashtirish', 'switch_project');
}

function buildPtoMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📊 Loyiha bajarilishi', 'pto:progress').row()
    .text('📐 Smeta vs Fakt', 'pto:comparison').row()
    .text('✅ Tasdiqlash', 'pto:pending').row()
    .text('💵 Kassa', 'kassa:menu').row()
    .text('🔄 Loyihani almashtirish', 'switch_project');
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: 'Super Admin',
    [UserRole.OPERATOR]: 'Operator',
    [UserRole.BOSS]: 'Boss',
    [UserRole.DIREKTOR]: 'Direktor',
    [UserRole.BUGALTERIYA]: 'Bugalteriya',
    [UserRole.PTO]: 'PTO',
    [UserRole.SNABJENIYA]: 'Snabjeniya',
    [UserRole.SKLAD]: 'Sklad',
    [UserRole.PRORAB]: 'Prorab',
    [UserRole.WORKER]: 'Ishchi',
    [UserRole.POSTAVSHIK]: 'Postavshik',
  };
  return labels[role] || role;
}
