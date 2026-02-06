import { Module } from '@nestjs/common';

import { VendorAuthController } from './vendor-auth.controller';
import { VendorAuthMapper } from './vendor-auth.mapper';
import { VendorAuthRepository } from './vendor-auth.repository';
import { VendorAuthService } from './vendor-auth.service';

@Module({
  controllers: [VendorAuthController],
  providers: [VendorAuthService, VendorAuthRepository, VendorAuthMapper],
  exports: [VendorAuthService],
})
export class VendorAuthModule {}
