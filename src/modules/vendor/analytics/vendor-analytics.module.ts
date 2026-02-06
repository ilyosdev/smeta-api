import { Module } from '@nestjs/common';

import { VendorAnalyticsController } from './vendor-analytics.controller';
import { VendorAnalyticsRepository } from './vendor-analytics.repository';
import { VendorAnalyticsService } from './vendor-analytics.service';

@Module({
  controllers: [VendorAnalyticsController],
  providers: [VendorAnalyticsService, VendorAnalyticsRepository],
  exports: [VendorAnalyticsService],
})
export class VendorAnalyticsModule {}
