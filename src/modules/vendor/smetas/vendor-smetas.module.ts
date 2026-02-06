import { Module } from '@nestjs/common';

import { VendorSmetasController } from './vendor-smetas.controller';
import { VendorSmetasMapper } from './vendor-smetas.mapper';
import { VendorSmetasRepository } from './vendor-smetas.repository';
import { VendorSmetasService } from './vendor-smetas.service';

@Module({
  controllers: [VendorSmetasController],
  providers: [VendorSmetasService, VendorSmetasRepository, VendorSmetasMapper],
  exports: [VendorSmetasService],
})
export class VendorSmetasModule {}
