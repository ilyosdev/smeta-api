import { Module } from '@nestjs/common';

import { VendorIncomesController } from './vendor-incomes.controller';
import { VendorIncomesMapper } from './vendor-incomes.mapper';
import { VendorIncomesRepository } from './vendor-incomes.repository';
import { VendorIncomesService } from './vendor-incomes.service';

@Module({
  controllers: [VendorIncomesController],
  providers: [VendorIncomesService, VendorIncomesRepository, VendorIncomesMapper],
  exports: [VendorIncomesService],
})
export class VendorIncomesModule {}
