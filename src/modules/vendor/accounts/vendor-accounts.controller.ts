import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import {
  AccountResponseDto,
  CreateAccountDto,
  PaginatedAccountResponseDto,
  QueryAccountDto,
  UpdateAccountDto,
} from './dto';
import { VendorAccountsMapper } from './vendor-accounts.mapper';
import { VendorAccountsService } from './vendor-accounts.service';

@ApiTags('[VENDOR] Accounts')
@Controller('vendor/accounts')
export class VendorAccountsController {
  constructor(
    private readonly service: VendorAccountsService,
    private readonly mapper: VendorAccountsMapper,
  ) {}

  @Post()
  @Endpoint('Create account', true)
  @ApiOkResponse({ type: AccountResponseDto })
  async createAccount(@Body() dto: CreateAccountDto, @User() user: IUser): Promise<AccountResponseDto> {
    const result = await this.service.createAccount(dto, user);
    return this.mapper.mapAccount(result);
  }

  @Get()
  @Endpoint('Get all accounts', true)
  @ApiOkResponse({ type: PaginatedAccountResponseDto })
  async findAllAccounts(@Query() query: QueryAccountDto, @User() user: IUser): Promise<PaginatedAccountResponseDto> {
    const result = await this.service.findAllAccounts(query, user);
    return this.mapper.mapPaginatedAccounts(result);
  }

  @Get(':id')
  @Endpoint('Get account by ID', true)
  @ApiOkResponse({ type: AccountResponseDto })
  async findOneAccount(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<AccountResponseDto> {
    const result = await this.service.findOneAccount(id, user);
    return this.mapper.mapAccount(result);
  }

  @Patch(':id')
  @Endpoint('Update account', true)
  @ApiOkResponse({ type: AccountResponseDto })
  async updateAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
    @User() user: IUser,
  ): Promise<AccountResponseDto> {
    const result = await this.service.updateAccount(id, dto, user);
    return this.mapper.mapAccount(result);
  }

  @Delete(':id')
  @Endpoint('Delete account', true)
  async removeAccount(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<{ success: boolean }> {
    await this.service.removeAccount(id, user);
    return { success: true };
  }
}
