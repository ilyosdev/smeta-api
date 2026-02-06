import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import {
  CashRegisterResponseDto,
  CashTransactionResponseDto,
  CreateCashRegisterDto,
  CreateCashTransactionDto,
  PaginatedCashRegisterResponseDto,
  PaginatedCashTransactionResponseDto,
  QueryCashRegisterDto,
  UpdateCashRegisterDto,
} from './dto';
import { VendorCashRegistersMapper } from './vendor-cash-registers.mapper';
import { VendorCashRegistersService } from './vendor-cash-registers.service';

@ApiTags('[VENDOR] Cash Registers')
@Controller('vendor/cash-registers')
export class VendorCashRegistersController {
  constructor(
    private readonly service: VendorCashRegistersService,
    private readonly mapper: VendorCashRegistersMapper,
  ) {}

  @Post()
  @Endpoint('Create cash register', true)
  @ApiOkResponse({ type: CashRegisterResponseDto })
  async createCashRegister(
    @Body() dto: CreateCashRegisterDto,
    @User() user: IUser,
  ): Promise<CashRegisterResponseDto> {
    const result = await this.service.createCashRegister(dto, user);
    return this.mapper.mapCashRegister(result);
  }

  @Get()
  @Endpoint('Get all cash registers', true)
  @ApiOkResponse({ type: PaginatedCashRegisterResponseDto })
  async findAllCashRegisters(
    @Query() query: QueryCashRegisterDto,
    @User() user: IUser,
  ): Promise<PaginatedCashRegisterResponseDto> {
    const result = await this.service.findAllCashRegisters(query, user);
    return this.mapper.mapPaginatedCashRegisters(result);
  }

  @Get(':id')
  @Endpoint('Get cash register by ID', true)
  @ApiOkResponse({ type: CashRegisterResponseDto })
  async findOneCashRegister(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
  ): Promise<CashRegisterResponseDto> {
    const result = await this.service.findOneCashRegister(id, user);
    return this.mapper.mapCashRegister(result);
  }

  @Patch(':id')
  @Endpoint('Update cash register', true)
  @ApiOkResponse({ type: CashRegisterResponseDto })
  async updateCashRegister(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCashRegisterDto,
    @User() user: IUser,
  ): Promise<CashRegisterResponseDto> {
    const result = await this.service.updateCashRegister(id, dto, user);
    return this.mapper.mapCashRegister(result);
  }

  @Delete(':id')
  @Endpoint('Delete cash register', true)
  async removeCashRegister(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<{ success: boolean }> {
    await this.service.removeCashRegister(id, user);
    return { success: true };
  }

  @Get(':id/transactions')
  @Endpoint('Get cash register transactions', true)
  @ApiOkResponse({ type: PaginatedCashTransactionResponseDto })
  async findCashTransactions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @User() user: IUser,
  ): Promise<PaginatedCashTransactionResponseDto> {
    const result = await this.service.findCashTransactions(id, user, page, limit);
    return this.mapper.mapPaginatedCashTransactions(result);
  }

  @Post('transactions')
  @Endpoint('Create cash transaction', true)
  @ApiOkResponse({ type: CashTransactionResponseDto })
  async createCashTransaction(
    @Body() dto: CreateCashTransactionDto,
    @User() user: IUser,
  ): Promise<CashTransactionResponseDto> {
    const result = await this.service.createCashTransaction(dto, user);
    return this.mapper.mapCashTransaction(result);
  }
}
