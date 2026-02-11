import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser, Roles } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';
import { DataSource } from 'src/common/database/schemas';

import {
  CashRequestResponseDto,
  CreateCashRequestDto,
  PaginatedCashRequestResponseDto,
  QueryCashRequestDto,
  RejectCashRequestDto,
} from './dto';
import { VendorCashRequestsMapper } from './vendor-cash-requests.mapper';
import { VendorCashRequestsService } from './vendor-cash-requests.service';

@ApiTags('[VENDOR] Cash Requests')
@Controller('vendor/cash-requests')
export class VendorCashRequestsController {
  constructor(
    private readonly service: VendorCashRequestsService,
    private readonly mapper: VendorCashRequestsMapper,
  ) {}

  @Post()
  @Endpoint('Create cash request', true)
  @ApiOkResponse({ type: CashRequestResponseDto })
  async create(
    @Body() dto: CreateCashRequestDto,
    @User() user: IUser,
  ): Promise<CashRequestResponseDto> {
    const result = await this.service.create(
      {
        projectId: dto.projectId,
        amount: dto.amount,
        reason: dto.reason,
        neededBy: dto.neededBy ? new Date(dto.neededBy) : undefined,
        source: DataSource.DASHBOARD,
      },
      user,
    );
    return this.mapper.mapCashRequest(result);
  }

  @Get()
  @Endpoint('Get all cash requests', true)
  @ApiOkResponse({ type: PaginatedCashRequestResponseDto })
  async findAll(
    @Query() query: QueryCashRequestDto,
    @User() user: IUser,
  ): Promise<PaginatedCashRequestResponseDto> {
    const result = await this.service.findAll(query, user);
    return this.mapper.mapPaginatedCashRequests(result);
  }

  @Get(':id')
  @Endpoint('Get cash request by ID', true)
  @ApiOkResponse({ type: CashRequestResponseDto })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
  ): Promise<CashRequestResponseDto> {
    const result = await this.service.findOne(id, user);
    return this.mapper.mapCashRequest(result);
  }

  @Patch(':id/approve')
  @Endpoint('Approve cash request', true, [Roles.BOSS, Roles.DIREKTOR, Roles.BUGALTERIYA])
  @ApiOkResponse({ type: CashRequestResponseDto })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
  ): Promise<CashRequestResponseDto> {
    const result = await this.service.approve(id, user);
    return this.mapper.mapCashRequest(result);
  }

  @Patch(':id/reject')
  @Endpoint('Reject cash request', true, [Roles.BOSS, Roles.DIREKTOR, Roles.BUGALTERIYA])
  @ApiOkResponse({ type: CashRequestResponseDto })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectCashRequestDto,
    @User() user: IUser,
  ): Promise<CashRequestResponseDto> {
    const result = await this.service.reject(id, dto, user);
    return this.mapper.mapCashRequest(result);
  }

  @Delete(':id')
  @Endpoint('Cancel cash request', true)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
  ): Promise<{ success: boolean }> {
    await this.service.remove(id, user);
    return { success: true };
  }
}
