import { Module } from '@nestjs/common';

import { VendorProjectsController } from './vendor-projects.controller';
import { VendorProjectsMapper } from './vendor-projects.mapper';
import { VendorProjectsRepository } from './vendor-projects.repository';
import { VendorProjectsService } from './vendor-projects.service';

@Module({
  controllers: [VendorProjectsController],
  providers: [VendorProjectsService, VendorProjectsRepository, VendorProjectsMapper],
  exports: [VendorProjectsService],
})
export class VendorProjectsModule {}
