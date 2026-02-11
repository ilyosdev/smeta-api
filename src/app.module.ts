import { MiddlewareConsumer, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';

import { env } from './common/config';
import { DrizzleModule } from './common/database/drizzle.module';
import { HttpExceptionFilter } from './common/middlewares/exception-filter.middleware';
import { AppLoggerMiddleware } from './common/middlewares/logger.middleware';

import { VendorAuthModule } from './modules/vendor/auth/vendor-auth.module';
import { VendorProjectsModule } from './modules/vendor/projects/vendor-projects.module';
import { VendorSmetasModule } from './modules/vendor/smetas/vendor-smetas.module';
import { VendorSmetaItemsModule } from './modules/vendor/smeta-items/vendor-smeta-items.module';
import { VendorUsersModule } from './modules/vendor/users/vendor-users.module';
import { VendorRequestsModule } from './modules/vendor/requests/vendor-requests.module';
import { VendorSuppliersModule } from './modules/vendor/suppliers/vendor-suppliers.module';
import { VendorWarehousesModule } from './modules/vendor/warehouses/vendor-warehouses.module';
import { VendorWorkersModule } from './modules/vendor/workers/vendor-workers.module';
import { VendorAccountsModule } from './modules/vendor/accounts/vendor-accounts.module';
import { VendorCashRegistersModule } from './modules/vendor/cash-registers/vendor-cash-registers.module';
import { VendorCashRequestsModule } from './modules/vendor/cash-requests/vendor-cash-requests.module';
import { VendorIncomesModule } from './modules/vendor/incomes/vendor-incomes.module';
import { VendorExpensesModule } from './modules/vendor/expenses/vendor-expenses.module';
import { VendorManualPurchasesModule } from './modules/vendor/manual-purchases/vendor-manual-purchases.module';
import { VendorAnalyticsModule } from './modules/vendor/analytics/vendor-analytics.module';
import { AdminModule } from './modules/admin/admin.module';
import { BotAuthModule } from './modules/bot/auth/bot-auth.module';
import { BotTelegramGroupsModule } from './modules/bot/telegram-groups/bot-telegram-groups.module';
import { TelegramModule } from './modules/bot/telegram/telegram.module';

@Module({
  imports: [
    DrizzleModule,
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
    }),
    AdminModule,
    VendorAuthModule,
    VendorProjectsModule,
    VendorSmetasModule,
    VendorSmetaItemsModule,
    VendorUsersModule,
    VendorRequestsModule,
    VendorSuppliersModule,
    VendorWarehousesModule,
    VendorWorkersModule,
    VendorAccountsModule,
    VendorCashRegistersModule,
    VendorCashRequestsModule,
    VendorIncomesModule,
    VendorExpensesModule,
    VendorManualPurchasesModule,
    VendorAnalyticsModule,
    BotAuthModule,
    BotTelegramGroupsModule,
    TelegramModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AppLoggerMiddleware).forRoutes('*');
  }
}
