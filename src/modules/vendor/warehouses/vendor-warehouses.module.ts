import { Module } from '@nestjs/common';

import { VendorWarehousesController } from './vendor-warehouses.controller';
import { VendorWarehousesMapper } from './vendor-warehouses.mapper';
import { VendorWarehousesRepository } from './vendor-warehouses.repository';
import { VendorWarehousesService } from './vendor-warehouses.service';

@Module({
  controllers: [VendorWarehousesController],
  providers: [VendorWarehousesService, VendorWarehousesRepository, VendorWarehousesMapper],
  exports: [VendorWarehousesService],
})
export class VendorWarehousesModule {}
