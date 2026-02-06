import { Module } from '@nestjs/common';

import { VendorCashRegistersController } from './vendor-cash-registers.controller';
import { VendorCashRegistersMapper } from './vendor-cash-registers.mapper';
import { VendorCashRegistersRepository } from './vendor-cash-registers.repository';
import { VendorCashRegistersService } from './vendor-cash-registers.service';

@Module({
  controllers: [VendorCashRegistersController],
  providers: [VendorCashRegistersService, VendorCashRegistersRepository, VendorCashRegistersMapper],
  exports: [VendorCashRegistersService],
})
export class VendorCashRegistersModule {}
