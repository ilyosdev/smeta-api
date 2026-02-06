import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser, Roles } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import {
  CreateSmetaDto,
  PaginatedSmetaResponseDto,
  QuerySmetaDto,
  SmetaResponseDto,
  UpdateSmetaDto,
} from './dto';
import { VendorSmetasMapper } from './vendor-smetas.mapper';
import { VendorSmetasService } from './vendor-smetas.service';

@ApiTags('[VENDOR] Smetas')
@Controller('vendor/smetas')
export class VendorSmetasController {
  constructor(
    private readonly service: VendorSmetasService,
    private readonly mapper: VendorSmetasMapper,
  ) {}

  @Post()
  @Endpoint('Create smeta', true, [Roles.BOSS, Roles.DIREKTOR, Roles.PTO])
  @ApiOkResponse({ type: SmetaResponseDto })
  async create(@Body() dto: CreateSmetaDto, @User() user: IUser): Promise<SmetaResponseDto> {
    const result = await this.service.create(dto, user);
    return this.mapper.mapSmeta(result);
  }

  @Get()
  @Endpoint('Get all smetas', true)
  @ApiOkResponse({ type: PaginatedSmetaResponseDto })
  async findAll(@Query() query: QuerySmetaDto, @User() user: IUser): Promise<PaginatedSmetaResponseDto> {
    const result = await this.service.findAll(query, user);
    return this.mapper.mapPaginatedSmetas(result);
  }

  @Get(':id')
  @Endpoint('Get smeta by ID', true)
  @ApiOkResponse({ type: SmetaResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<SmetaResponseDto> {
    const result = await this.service.findOne(id, user);
    return this.mapper.mapSmeta(result);
  }

  @Patch(':id')
  @Endpoint('Update smeta', true, [Roles.BOSS, Roles.DIREKTOR, Roles.PTO])
  @ApiOkResponse({ type: SmetaResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSmetaDto,
    @User() user: IUser,
  ): Promise<SmetaResponseDto> {
    const result = await this.service.update(id, dto, user);
    return this.mapper.mapSmeta(result);
  }

  @Delete(':id')
  @Endpoint('Delete smeta', true, [Roles.BOSS, Roles.DIREKTOR])
  async remove(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<{ success: boolean }> {
    await this.service.remove(id, user);
    return { success: true };
  }
}
