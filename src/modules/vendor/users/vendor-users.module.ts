import { Module } from '@nestjs/common';

import { VendorUsersController } from './vendor-users.controller';
import { VendorUsersMapper } from './vendor-users.mapper';
import { VendorUsersRepository } from './vendor-users.repository';
import { VendorUsersService } from './vendor-users.service';

@Module({
  controllers: [VendorUsersController],
  providers: [VendorUsersService, VendorUsersRepository, VendorUsersMapper],
  exports: [VendorUsersService],
})
export class VendorUsersModule {}
