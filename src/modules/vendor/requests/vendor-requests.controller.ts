import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser, Roles } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import {
  CreateRequestDto,
  PaginatedRequestResponseDto,
  QueryRequestDto,
  RejectRequestDto,
  RequestResponseDto,
  UpdateRequestDto,
} from './dto';
import { VendorRequestsMapper } from './vendor-requests.mapper';
import { VendorRequestsService } from './vendor-requests.service';

@ApiTags('[VENDOR] Purchase Requests')
@Controller('vendor/requests')
export class VendorRequestsController {
  constructor(
    private readonly service: VendorRequestsService,
    private readonly mapper: VendorRequestsMapper,
  ) {}

  @Post()
  @Endpoint('Create purchase request', true)
  @ApiOkResponse({ type: RequestResponseDto })
  async create(@Body() dto: CreateRequestDto, @User() user: IUser): Promise<RequestResponseDto> {
    const result = await this.service.create(dto, user);
    return this.mapper.mapRequest(result);
  }

  @Get()
  @Endpoint('Get all purchase requests', true)
  @ApiOkResponse({ type: PaginatedRequestResponseDto })
  async findAll(@Query() query: QueryRequestDto, @User() user: IUser): Promise<PaginatedRequestResponseDto> {
    const result = await this.service.findAll(query, user);
    return this.mapper.mapPaginatedRequests(result);
  }

  @Get(':id')
  @Endpoint('Get purchase request by ID', true)
  @ApiOkResponse({ type: RequestResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<RequestResponseDto> {
    const result = await this.service.findOne(id, user);
    return this.mapper.mapRequest(result);
  }

  @Patch(':id')
  @Endpoint('Update purchase request', true)
  @ApiOkResponse({ type: RequestResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequestDto,
    @User() user: IUser,
  ): Promise<RequestResponseDto> {
    const result = await this.service.update(id, dto, user);
    return this.mapper.mapRequest(result);
  }

  @Post(':id/approve')
  @Endpoint('Approve purchase request', true, [Roles.BOSS, Roles.DIREKTOR, Roles.BUGALTERIYA])
  @ApiOkResponse({ type: RequestResponseDto })
  async approve(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<RequestResponseDto> {
    const result = await this.service.approve(id, user);
    return this.mapper.mapRequest(result);
  }

  @Post(':id/reject')
  @Endpoint('Reject purchase request', true, [Roles.BOSS, Roles.DIREKTOR, Roles.BUGALTERIYA])
  @ApiOkResponse({ type: RequestResponseDto })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRequestDto,
    @User() user: IUser,
  ): Promise<RequestResponseDto> {
    const result = await this.service.reject(id, dto, user);
    return this.mapper.mapRequest(result);
  }

  @Delete(':id')
  @Endpoint('Delete purchase request', true)
  async remove(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<{ success: boolean }> {
    await this.service.remove(id, user);
    return { success: true };
  }
}
