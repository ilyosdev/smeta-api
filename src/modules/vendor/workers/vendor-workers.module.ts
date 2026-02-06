import { Module } from '@nestjs/common';

import { VendorWorkersController } from './vendor-workers.controller';
import { VendorWorkersMapper } from './vendor-workers.mapper';
import { VendorWorkersRepository } from './vendor-workers.repository';
import { VendorWorkersService } from './vendor-workers.service';

@Module({
  controllers: [VendorWorkersController],
  providers: [VendorWorkersService, VendorWorkersRepository, VendorWorkersMapper],
  exports: [VendorWorkersService],
})
export class VendorWorkersModule {}
