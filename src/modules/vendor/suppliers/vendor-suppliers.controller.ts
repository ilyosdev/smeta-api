import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import {
  CreateSupplierDebtDto,
  CreateSupplierDto,
  CreateSupplyOrderDto,
  PaginatedSupplierDebtResponseDto,
  PaginatedSupplierResponseDto,
  PaginatedSupplyOrderResponseDto,
  QuerySupplierDto,
  QuerySupplyOrderDto,
  SupplierDebtResponseDto,
  SupplierResponseDto,
  SupplyOrderResponseDto,
  UpdateSupplierDto,
  UpdateSupplyOrderDto,
} from './dto';
import { VendorSuppliersMapper } from './vendor-suppliers.mapper';
import { VendorSuppliersService } from './vendor-suppliers.service';

@ApiTags('[VENDOR] Suppliers')
@Controller('vendor/suppliers')
export class VendorSuppliersController {
  constructor(
    private readonly service: VendorSuppliersService,
    private readonly mapper: VendorSuppliersMapper,
  ) {}

  @Post()
  @Endpoint('Create supplier', true)
  @ApiOkResponse({ type: SupplierResponseDto })
  async createSupplier(@Body() dto: CreateSupplierDto, @User() user: IUser): Promise<SupplierResponseDto> {
    const result = await this.service.createSupplier(dto, user);
    return this.mapper.mapSupplier(result);
  }

  @Get()
  @Endpoint('Get all suppliers', true)
  @ApiOkResponse({ type: PaginatedSupplierResponseDto })
  async findAllSuppliers(@Query() query: QuerySupplierDto, @User() user: IUser): Promise<PaginatedSupplierResponseDto> {
    const result = await this.service.findAllSuppliers(query, user);
    return this.mapper.mapPaginatedSuppliers(result);
  }

  @Get(':id')
  @Endpoint('Get supplier by ID', true)
  @ApiOkResponse({ type: SupplierResponseDto })
  async findOneSupplier(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<SupplierResponseDto> {
    const result = await this.service.findOneSupplier(id, user);
    return this.mapper.mapSupplier(result);
  }

  @Patch(':id')
  @Endpoint('Update supplier', true)
  @ApiOkResponse({ type: SupplierResponseDto })
  async updateSupplier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
    @User() user: IUser,
  ): Promise<SupplierResponseDto> {
    const result = await this.service.updateSupplier(id, dto, user);
    return this.mapper.mapSupplier(result);
  }

  @Delete(':id')
  @Endpoint('Delete supplier', true)
  async removeSupplier(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<{ success: boolean }> {
    await this.service.removeSupplier(id, user);
    return { success: true };
  }

  @Get(':id/debts')
  @Endpoint('Get supplier debts', true)
  @ApiOkResponse({ type: PaginatedSupplierDebtResponseDto })
  async findSupplierDebts(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @User() user: IUser,
  ): Promise<PaginatedSupplierDebtResponseDto> {
    const result = await this.service.findSupplierDebts(id, user, page, limit);
    return this.mapper.mapPaginatedSupplierDebts(result);
  }

  @Post('debts')
  @Endpoint('Create supplier debt', true)
  @ApiOkResponse({ type: SupplierDebtResponseDto })
  async createSupplierDebt(@Body() dto: CreateSupplierDebtDto, @User() user: IUser): Promise<SupplierDebtResponseDto> {
    const result = await this.service.createSupplierDebt(dto, user);
    return this.mapper.mapSupplierDebt(result);
  }

  @Post('debts/:id/pay')
  @Endpoint('Pay supplier debt', true)
  async paySupplierDebt(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<{ success: boolean }> {
    return this.service.paySupplierDebt(id, user);
  }

  @Post('orders')
  @Endpoint('Create supply order', true)
  @ApiOkResponse({ type: SupplyOrderResponseDto })
  async createSupplyOrder(@Body() dto: CreateSupplyOrderDto, @User() user: IUser): Promise<SupplyOrderResponseDto> {
    const result = await this.service.createSupplyOrder(dto, user);
    return this.mapper.mapSupplyOrder(result);
  }

  @Get('orders/list')
  @Endpoint('Get all supply orders', true)
  @ApiOkResponse({ type: PaginatedSupplyOrderResponseDto })
  async findAllSupplyOrders(
    @Query() query: QuerySupplyOrderDto,
    @User() user: IUser,
  ): Promise<PaginatedSupplyOrderResponseDto> {
    const result = await this.service.findAllSupplyOrders(query, user);
    return this.mapper.mapPaginatedSupplyOrders(result);
  }

  @Get('orders/:id')
  @Endpoint('Get supply order by ID', true)
  @ApiOkResponse({ type: SupplyOrderResponseDto })
  async findOneSupplyOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
  ): Promise<SupplyOrderResponseDto> {
    const result = await this.service.findOneSupplyOrder(id, user);
    return this.mapper.mapSupplyOrder(result);
  }

  @Patch('orders/:id')
  @Endpoint('Update supply order', true)
  @ApiOkResponse({ type: SupplyOrderResponseDto })
  async updateSupplyOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplyOrderDto,
    @User() user: IUser,
  ): Promise<SupplyOrderResponseDto> {
    const result = await this.service.updateSupplyOrder(id, dto, user);
    return this.mapper.mapSupplyOrder(result);
  }

  @Delete('orders/:id')
  @Endpoint('Delete supply order', true)
  async removeSupplyOrder(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<{ success: boolean }> {
    await this.service.removeSupplyOrder(id, user);
    return { success: true };
  }
}
