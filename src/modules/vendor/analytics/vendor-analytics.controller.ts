import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import {
  DashboardSummaryDto,
  SupplierDebtsSummaryDto,
  WorkerDebtsSummaryDto,
  WarehouseValueSummaryDto,
  WorkCompletionSummaryDto,
  ProfitLossSummaryDto,
  AccountBalancesSummaryDto,
} from './dto';
import { VendorAnalyticsService } from './vendor-analytics.service';

@ApiTags('[VENDOR] Analytics')
@Controller('vendor/analytics')
export class VendorAnalyticsController {
  constructor(private readonly service: VendorAnalyticsService) {}

  @Get('summary')
  @Endpoint('Get dashboard summary', true)
  @ApiOkResponse({ type: DashboardSummaryDto })
  async getDashboardSummary(@User() user: IUser): Promise<DashboardSummaryDto> {
    return this.service.getDashboardSummary(user);
  }

  @Get('supplier-debts')
  @Endpoint('Get supplier debts summary', true)
  @ApiOkResponse({ type: SupplierDebtsSummaryDto })
  async getSupplierDebts(@User() user: IUser): Promise<SupplierDebtsSummaryDto> {
    return this.service.getSupplierDebts(user);
  }

  @Get('worker-debts')
  @Endpoint('Get worker debts summary', true)
  @ApiOkResponse({ type: WorkerDebtsSummaryDto })
  async getWorkerDebts(@User() user: IUser): Promise<WorkerDebtsSummaryDto> {
    return this.service.getWorkerDebts(user);
  }

  @Get('warehouse-value')
  @Endpoint('Get warehouse value summary', true)
  @ApiOkResponse({ type: WarehouseValueSummaryDto })
  async getWarehouseValue(@User() user: IUser): Promise<WarehouseValueSummaryDto> {
    return this.service.getWarehouseValue(user);
  }

  @Get('work-completion')
  @Endpoint('Get work completion summary', true)
  @ApiOkResponse({ type: WorkCompletionSummaryDto })
  async getWorkCompletion(@User() user: IUser): Promise<WorkCompletionSummaryDto> {
    return this.service.getWorkCompletion(user);
  }

  @Get('profit-loss')
  @Endpoint('Get profit/loss summary', true)
  @ApiOkResponse({ type: ProfitLossSummaryDto })
  async getProfitLoss(@User() user: IUser): Promise<ProfitLossSummaryDto> {
    return this.service.getProfitLoss(user);
  }

  @Get('account-balances')
  @Endpoint('Get account balances summary', true)
  @ApiOkResponse({ type: AccountBalancesSummaryDto })
  async getAccountBalances(@User() user: IUser): Promise<AccountBalancesSummaryDto> {
    return this.service.getAccountBalances(user);
  }
}
