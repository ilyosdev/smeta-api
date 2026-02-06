import { Module } from '@nestjs/common';

import { VendorExpensesController } from './vendor-expenses.controller';
import { VendorExpensesMapper } from './vendor-expenses.mapper';
import { VendorExpensesRepository } from './vendor-expenses.repository';
import { VendorExpensesService } from './vendor-expenses.service';

@Module({
  controllers: [VendorExpensesController],
  providers: [VendorExpensesService, VendorExpensesRepository, VendorExpensesMapper],
  exports: [VendorExpensesService],
})
export class VendorExpensesModule {}
