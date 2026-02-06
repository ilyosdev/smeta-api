import { Module } from '@nestjs/common';

import { VendorAccountsController } from './vendor-accounts.controller';
import { VendorAccountsMapper } from './vendor-accounts.mapper';
import { VendorAccountsRepository } from './vendor-accounts.repository';
import { VendorAccountsService } from './vendor-accounts.service';

@Module({
  controllers: [VendorAccountsController],
  providers: [VendorAccountsService, VendorAccountsRepository, VendorAccountsMapper],
  exports: [VendorAccountsService],
})
export class VendorAccountsModule {}
