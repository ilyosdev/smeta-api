import { Module } from '@nestjs/common';

import { VendorRequestsController } from './vendor-requests.controller';
import { VendorRequestsMapper } from './vendor-requests.mapper';
import { VendorRequestsRepository } from './vendor-requests.repository';
import { VendorRequestsService } from './vendor-requests.service';

@Module({
  controllers: [VendorRequestsController],
  providers: [VendorRequestsService, VendorRequestsRepository, VendorRequestsMapper],
  exports: [VendorRequestsService],
})
export class VendorRequestsModule {}
