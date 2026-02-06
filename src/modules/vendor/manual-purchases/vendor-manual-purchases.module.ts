import { Module } from '@nestjs/common';

import { VendorManualPurchasesController } from './vendor-manual-purchases.controller';
import { VendorManualPurchasesMapper } from './vendor-manual-purchases.mapper';
import { VendorManualPurchasesRepository } from './vendor-manual-purchases.repository';
import { VendorManualPurchasesService } from './vendor-manual-purchases.service';

@Module({
  controllers: [VendorManualPurchasesController],
  providers: [VendorManualPurchasesService, VendorManualPurchasesRepository, VendorManualPurchasesMapper],
  exports: [VendorManualPurchasesService],
})
export class VendorManualPurchasesModule {}
