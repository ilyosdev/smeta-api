import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import {
  CreateWarehouseDto,
  CreateWarehouseItemDto,
  CreateWarehouseTransferDto,
  PaginatedWarehouseItemResponseDto,
  PaginatedWarehouseResponseDto,
  PaginatedWarehouseTransferResponseDto,
  QueryWarehouseDto,
  UpdateWarehouseDto,
  UpdateWarehouseItemDto,
  WarehouseItemResponseDto,
  WarehouseResponseDto,
  WarehouseTransferResponseDto,
} from './dto';
import { VendorWarehousesMapper } from './vendor-warehouses.mapper';
import { VendorWarehousesService } from './vendor-warehouses.service';

@ApiTags('[VENDOR] Warehouses')
@Controller('vendor/warehouses')
export class VendorWarehousesController {
  constructor(
    private readonly service: VendorWarehousesService,
    private readonly mapper: VendorWarehousesMapper,
  ) {}

  @Post()
  @Endpoint('Create warehouse', true)
  @ApiOkResponse({ type: WarehouseResponseDto })
  async createWarehouse(@Body() dto: CreateWarehouseDto, @User() user: IUser): Promise<WarehouseResponseDto> {
    const result = await this.service.createWarehouse(dto, user);
    return this.mapper.mapWarehouse(result);
  }

  @Get()
  @Endpoint('Get all warehouses', true)
  @ApiOkResponse({ type: PaginatedWarehouseResponseDto })
  async findAllWarehouses(
    @Query() query: QueryWarehouseDto,
    @User() user: IUser,
  ): Promise<PaginatedWarehouseResponseDto> {
    const result = await this.service.findAllWarehouses(query, user);
    return this.mapper.mapPaginatedWarehouses(result);
  }

  @Get(':id')
  @Endpoint('Get warehouse by ID', true)
  @ApiOkResponse({ type: WarehouseResponseDto })
  async findOneWarehouse(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<WarehouseResponseDto> {
    const result = await this.service.findOneWarehouse(id, user);
    return this.mapper.mapWarehouse(result);
  }

  @Patch(':id')
  @Endpoint('Update warehouse', true)
  @ApiOkResponse({ type: WarehouseResponseDto })
  async updateWarehouse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseDto,
    @User() user: IUser,
  ): Promise<WarehouseResponseDto> {
    const result = await this.service.updateWarehouse(id, dto, user);
    return this.mapper.mapWarehouse(result);
  }

  @Delete(':id')
  @Endpoint('Delete warehouse', true)
  async removeWarehouse(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<{ success: boolean }> {
    await this.service.removeWarehouse(id, user);
    return { success: true };
  }

  @Get(':id/items')
  @Endpoint('Get warehouse items', true)
  @ApiOkResponse({ type: PaginatedWarehouseItemResponseDto })
  async findWarehouseItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @User() user: IUser,
  ): Promise<PaginatedWarehouseItemResponseDto> {
    const result = await this.service.findWarehouseItems(id, user, page, limit);
    return this.mapper.mapPaginatedWarehouseItems(result);
  }

  @Post('items')
  @Endpoint('Create warehouse item', true)
  @ApiOkResponse({ type: WarehouseItemResponseDto })
  async createWarehouseItem(
    @Body() dto: CreateWarehouseItemDto,
    @User() user: IUser,
  ): Promise<WarehouseItemResponseDto> {
    const result = await this.service.createWarehouseItem(dto, user);
    return this.mapper.mapWarehouseItem(result);
  }

  @Patch('items/:id')
  @Endpoint('Update warehouse item', true)
  @ApiOkResponse({ type: WarehouseItemResponseDto })
  async updateWarehouseItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseItemDto,
    @User() user: IUser,
  ): Promise<WarehouseItemResponseDto> {
    const result = await this.service.updateWarehouseItem(id, dto, user);
    return this.mapper.mapWarehouseItem(result);
  }

  @Delete('items/:id')
  @Endpoint('Delete warehouse item', true)
  async removeWarehouseItem(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
  ): Promise<{ success: boolean }> {
    await this.service.removeWarehouseItem(id, user);
    return { success: true };
  }

  @Post('transfers')
  @Endpoint('Create warehouse transfer', true)
  @ApiOkResponse({ type: WarehouseTransferResponseDto })
  async createTransfer(
    @Body() dto: CreateWarehouseTransferDto,
    @User() user: IUser,
  ): Promise<WarehouseTransferResponseDto> {
    const result = await this.service.createTransfer(dto, user);
    return this.mapper.mapTransfer(result);
  }

  @Get('transfers/list')
  @Endpoint('Get all transfers', true)
  @ApiOkResponse({ type: PaginatedWarehouseTransferResponseDto })
  async findAllTransfers(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('warehouseId') warehouseId: string,
    @User() user: IUser,
  ): Promise<PaginatedWarehouseTransferResponseDto> {
    const result = await this.service.findAllTransfers(user, page, limit, warehouseId);
    return this.mapper.mapPaginatedTransfers(result);
  }

  @Get('transfers/:id')
  @Endpoint('Get transfer by ID', true)
  @ApiOkResponse({ type: WarehouseTransferResponseDto })
  async findOneTransfer(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
  ): Promise<WarehouseTransferResponseDto> {
    const result = await this.service.findOneTransfer(id, user);
    return this.mapper.mapTransfer(result);
  }

  @Post('transfers/:id/complete')
  @Endpoint('Complete transfer', true)
  @ApiOkResponse({ type: WarehouseTransferResponseDto })
  async completeTransfer(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
  ): Promise<WarehouseTransferResponseDto> {
    const result = await this.service.completeTransfer(id, user);
    return this.mapper.mapTransfer(result);
  }

  @Post('transfers/:id/cancel')
  @Endpoint('Cancel transfer', true)
  @ApiOkResponse({ type: WarehouseTransferResponseDto })
  async cancelTransfer(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
  ): Promise<WarehouseTransferResponseDto> {
    const result = await this.service.cancelTransfer(id, user);
    return this.mapper.mapTransfer(result);
  }
}
