import { Module } from '@nestjs/common';

import { BotAuthModule } from '../auth/bot-auth.module';
import { BotAdminModule } from '../admin/bot-admin.module';
import { AiModule } from '../ai/ai.module';
import { VendorProjectsModule } from 'src/modules/vendor/projects/vendor-projects.module';
import { VendorAnalyticsModule } from 'src/modules/vendor/analytics/vendor-analytics.module';
import { VendorExpensesModule } from 'src/modules/vendor/expenses/vendor-expenses.module';
import { VendorWarehousesModule } from 'src/modules/vendor/warehouses/vendor-warehouses.module';
import { VendorIncomesModule } from 'src/modules/vendor/incomes/vendor-incomes.module';
import { VendorCashRegistersModule } from 'src/modules/vendor/cash-registers/vendor-cash-registers.module';
import { VendorSuppliersModule } from 'src/modules/vendor/suppliers/vendor-suppliers.module';
import { VendorWorkersModule } from 'src/modules/vendor/workers/vendor-workers.module';
import { VendorRequestsModule } from 'src/modules/vendor/requests/vendor-requests.module';
import { VendorSmetaItemsModule } from 'src/modules/vendor/smeta-items/vendor-smeta-items.module';
import { VendorCashRequestsModule } from 'src/modules/vendor/cash-requests/vendor-cash-requests.module';
import { VendorUsersModule } from 'src/modules/vendor/users/vendor-users.module';
import { VendorSmetasModule } from 'src/modules/vendor/smetas/vendor-smetas.module';

import { TelegramService } from './telegram.service';
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
import { DriverMenu } from './menus/driver.menu';
import { ModeratorMenu } from './menus/moderator.menu';

@Module({
  imports: [
    AiModule,
    BotAuthModule,
    BotAdminModule,
    VendorProjectsModule,
    VendorAnalyticsModule,
    VendorExpensesModule,
    VendorWarehousesModule,
    VendorIncomesModule,
    VendorCashRegistersModule,
    VendorSuppliersModule,
    VendorWorkersModule,
    VendorRequestsModule,
    VendorSmetaItemsModule,
    VendorCashRequestsModule,
    VendorUsersModule,
    VendorSmetasModule,
  ],
  providers: [
    TelegramService,
    StartHandler,
    ProjectHandler,
    MenuHandler,
    BossMenu,
    AccountantMenu,
    WarehouseMenu,
    SupplyMenu,
    ForemanMenu,
    PtoMenu,
    DirekterMenu,
    KassaMenu,
    SuperAdminMenu,
    OperatorMenu,
    WorkerMenu,
    SupplierMenu,
    DriverMenu,
    ModeratorMenu,
  ],
})
export class TelegramModule {}
