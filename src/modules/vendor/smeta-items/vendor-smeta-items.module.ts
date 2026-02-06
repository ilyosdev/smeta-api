import { Module } from '@nestjs/common';

import { VendorSmetaItemsController } from './vendor-smeta-items.controller';
import { VendorSmetaItemsMapper } from './vendor-smeta-items.mapper';
import { VendorSmetaItemsRepository } from './vendor-smeta-items.repository';
import { VendorSmetaItemsService } from './vendor-smeta-items.service';

@Module({
  controllers: [VendorSmetaItemsController],
  providers: [VendorSmetaItemsService, VendorSmetaItemsRepository, VendorSmetaItemsMapper],
  exports: [VendorSmetaItemsService],
})
export class VendorSmetaItemsModule {}
