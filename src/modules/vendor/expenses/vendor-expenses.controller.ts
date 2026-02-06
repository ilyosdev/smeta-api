import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import { CreateExpenseDto, ExpenseResponseDto, PaginatedExpenseResponseDto, QueryExpenseDto } from './dto';
import { VendorExpensesMapper } from './vendor-expenses.mapper';
import { VendorExpensesService } from './vendor-expenses.service';

@ApiTags('[VENDOR] Expenses')
@Controller('vendor/expenses')
export class VendorExpensesController {
  constructor(
    private readonly service: VendorExpensesService,
    private readonly mapper: VendorExpensesMapper,
  ) {}

  @Post()
  @Endpoint('Create expense', true)
  @ApiOkResponse({ type: ExpenseResponseDto })
  async createExpense(@Body() dto: CreateExpenseDto, @User() user: IUser): Promise<ExpenseResponseDto> {
    const result = await this.service.createExpense(dto, user);
    return this.mapper.mapExpense(result);
  }

  @Get()
  @Endpoint('Get all expenses', true)
  @ApiOkResponse({ type: PaginatedExpenseResponseDto })
  async findAllExpenses(
    @Query() query: QueryExpenseDto,
    @User() user: IUser,
  ): Promise<PaginatedExpenseResponseDto> {
    const result = await this.service.findAllExpenses(query, user);
    return this.mapper.mapPaginatedExpenses(result);
  }

  @Get(':id')
  @Endpoint('Get expense by ID', true)
  @ApiOkResponse({ type: ExpenseResponseDto })
  async findOneExpense(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<ExpenseResponseDto> {
    const result = await this.service.findOneExpense(id, user);
    return this.mapper.mapExpense(result);
  }

  @Delete(':id')
  @Endpoint('Delete expense', true)
  async removeExpense(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<{ success: boolean }> {
    await this.service.removeExpense(id, user);
    return { success: true };
  }
}
