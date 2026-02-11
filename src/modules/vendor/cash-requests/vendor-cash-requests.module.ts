import { Module } from '@nestjs/common';

import { VendorCashRegistersModule } from '../cash-registers/vendor-cash-registers.module';

import { VendorCashRequestsController } from './vendor-cash-requests.controller';
import { VendorCashRequestsMapper } from './vendor-cash-requests.mapper';
import { VendorCashRequestsRepository } from './vendor-cash-requests.repository';
import { VendorCashRequestsService } from './vendor-cash-requests.service';

@Module({
  imports: [VendorCashRegistersModule],
  controllers: [VendorCashRequestsController],
  providers: [VendorCashRequestsService, VendorCashRequestsRepository, VendorCashRequestsMapper],
  exports: [VendorCashRequestsService],
})
export class VendorCashRequestsModule {}
