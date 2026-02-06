import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import { CreateIncomeDto, IncomeResponseDto, PaginatedIncomeResponseDto, QueryIncomeDto } from './dto';
import { VendorIncomesMapper } from './vendor-incomes.mapper';
import { VendorIncomesService } from './vendor-incomes.service';

@ApiTags('[VENDOR] Incomes')
@Controller('vendor/incomes')
export class VendorIncomesController {
  constructor(
    private readonly service: VendorIncomesService,
    private readonly mapper: VendorIncomesMapper,
  ) {}

  @Post()
  @Endpoint('Create income', true)
  @ApiOkResponse({ type: IncomeResponseDto })
  async createIncome(@Body() dto: CreateIncomeDto, @User() user: IUser): Promise<IncomeResponseDto> {
    const result = await this.service.createIncome(dto, user);
    return this.mapper.mapIncome(result);
  }

  @Get()
  @Endpoint('Get all incomes', true)
  @ApiOkResponse({ type: PaginatedIncomeResponseDto })
  async findAllIncomes(
    @Query() query: QueryIncomeDto,
    @User() user: IUser,
  ): Promise<PaginatedIncomeResponseDto> {
    const result = await this.service.findAllIncomes(query, user);
    return this.mapper.mapPaginatedIncomes(result);
  }

  @Get(':id')
  @Endpoint('Get income by ID', true)
  @ApiOkResponse({ type: IncomeResponseDto })
  async findOneIncome(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<IncomeResponseDto> {
    const result = await this.service.findOneIncome(id, user);
    return this.mapper.mapIncome(result);
  }

  @Delete(':id')
  @Endpoint('Delete income', true)
  async removeIncome(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<{ success: boolean }> {
    await this.service.removeIncome(id, user);
    return { success: true };
  }
}
