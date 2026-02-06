import { Module } from '@nestjs/common';

import { VendorSuppliersController } from './vendor-suppliers.controller';
import { VendorSuppliersMapper } from './vendor-suppliers.mapper';
import { VendorSuppliersRepository } from './vendor-suppliers.repository';
import { VendorSuppliersService } from './vendor-suppliers.service';

@Module({
  controllers: [VendorSuppliersController],
  providers: [VendorSuppliersService, VendorSuppliersRepository, VendorSuppliersMapper],
  exports: [VendorSuppliersService],
})
export class VendorSuppliersModule {}
