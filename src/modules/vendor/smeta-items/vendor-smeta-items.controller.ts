import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import {
  CreateSmetaItemDto,
  PaginatedSmetaItemResponseDto,
  QuerySmetaItemDto,
  SmetaItemResponseDto,
  UpdateSmetaItemDto,
} from './dto';
import { VendorSmetaItemsMapper } from './vendor-smeta-items.mapper';
import { VendorSmetaItemsService } from './vendor-smeta-items.service';

@ApiTags('[VENDOR] Smeta Items')
@Controller('vendor/smeta-items')
export class VendorSmetaItemsController {
  constructor(
    private readonly service: VendorSmetaItemsService,
    private readonly mapper: VendorSmetaItemsMapper,
  ) {}

  @Post()
  @Endpoint('Create smeta item', true)
  @ApiOkResponse({ type: SmetaItemResponseDto })
  async create(@Body() dto: CreateSmetaItemDto, @User() user: IUser): Promise<SmetaItemResponseDto> {
    const result = await this.service.create(dto, user);
    return this.mapper.mapSmetaItem(result);
  }

  @Get()
  @Endpoint('Get all smeta items', true)
  @ApiOkResponse({ type: PaginatedSmetaItemResponseDto })
  async findAll(@Query() query: QuerySmetaItemDto, @User() user: IUser): Promise<PaginatedSmetaItemResponseDto> {
    const result = await this.service.findAll(query, user);
    return this.mapper.mapPaginatedSmetaItems(result);
  }

  @Get(':id')
  @Endpoint('Get smeta item by ID', true)
  @ApiOkResponse({ type: SmetaItemResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<SmetaItemResponseDto> {
    const result = await this.service.findOne(id, user);
    return this.mapper.mapSmetaItem(result);
  }

  @Patch(':id')
  @Endpoint('Update smeta item', true)
  @ApiOkResponse({ type: SmetaItemResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSmetaItemDto,
    @User() user: IUser,
  ): Promise<SmetaItemResponseDto> {
    const result = await this.service.update(id, dto, user);
    return this.mapper.mapSmetaItem(result);
  }

  @Delete(':id')
  @Endpoint('Delete smeta item', true)
  async remove(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<{ success: boolean }> {
    await this.service.remove(id, user);
    return { success: true };
  }
}
