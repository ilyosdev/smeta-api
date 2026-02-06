import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import {
  CreateManualPurchaseDto,
  UpdateManualPurchaseDto,
  ManualPurchaseResponseDto,
  PaginatedManualPurchaseResponseDto,
  QueryManualPurchaseDto,
} from './dto';
import { VendorManualPurchasesMapper } from './vendor-manual-purchases.mapper';
import { VendorManualPurchasesService } from './vendor-manual-purchases.service';

@ApiTags('[VENDOR] Manual Purchases')
@Controller('vendor/manual-purchases')
export class VendorManualPurchasesController {
  constructor(
    private readonly service: VendorManualPurchasesService,
    private readonly mapper: VendorManualPurchasesMapper,
  ) {}

  @Post()
  @Endpoint('Create manual purchase', true)
  @ApiOkResponse({ type: ManualPurchaseResponseDto })
  async createManualPurchase(
    @Body() dto: CreateManualPurchaseDto,
    @User() user: IUser,
  ): Promise<ManualPurchaseResponseDto> {
    const result = await this.service.createManualPurchase(dto, user);
    return this.mapper.mapManualPurchase(result);
  }

  @Get()
  @Endpoint('Get all manual purchases', true)
  @ApiOkResponse({ type: PaginatedManualPurchaseResponseDto })
  async findAllManualPurchases(
    @Query() query: QueryManualPurchaseDto,
    @User() user: IUser,
  ): Promise<PaginatedManualPurchaseResponseDto> {
    const result = await this.service.findAllManualPurchases(query, user);
    return this.mapper.mapPaginatedManualPurchases(result);
  }

  @Get(':id')
  @Endpoint('Get manual purchase by ID', true)
  @ApiOkResponse({ type: ManualPurchaseResponseDto })
  async findOneManualPurchase(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
  ): Promise<ManualPurchaseResponseDto> {
    const result = await this.service.findOneManualPurchase(id, user);
    return this.mapper.mapManualPurchase(result);
  }

  @Patch(':id')
  @Endpoint('Update manual purchase', true)
  @ApiOkResponse({ type: ManualPurchaseResponseDto })
  async updateManualPurchase(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateManualPurchaseDto,
    @User() user: IUser,
  ): Promise<ManualPurchaseResponseDto> {
    const result = await this.service.updateManualPurchase(id, dto, user);
    return this.mapper.mapManualPurchase(result);
  }

  @Delete(':id')
  @Endpoint('Delete manual purchase', true)
  async removeManualPurchase(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
  ): Promise<{ success: boolean }> {
    await this.service.removeManualPurchase(id, user);
    return { success: true };
  }
}
