import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import {
  CreateWorkerDto,
  CreateWorkLogDto,
  CreateWorkerPaymentDto,
  PaginatedWorkerPaymentResponseDto,
  PaginatedWorkerResponseDto,
  PaginatedWorkLogResponseDto,
  QueryWorkerDto,
  UpdateWorkerDto,
  ValidateWorkLogDto,
  WorkerPaymentResponseDto,
  WorkerResponseDto,
  WorkLogResponseDto,
} from './dto';
import { VendorWorkersMapper } from './vendor-workers.mapper';
import { VendorWorkersService } from './vendor-workers.service';

@ApiTags('[VENDOR] Workers')
@Controller('vendor/workers')
export class VendorWorkersController {
  constructor(
    private readonly service: VendorWorkersService,
    private readonly mapper: VendorWorkersMapper,
  ) {}

  @Post()
  @Endpoint('Create worker', true)
  @ApiOkResponse({ type: WorkerResponseDto })
  async createWorker(@Body() dto: CreateWorkerDto, @User() user: IUser): Promise<WorkerResponseDto> {
    const result = await this.service.createWorker(dto, user);
    return this.mapper.mapWorker(result);
  }

  @Get()
  @Endpoint('Get all workers', true)
  @ApiOkResponse({ type: PaginatedWorkerResponseDto })
  async findAllWorkers(@Query() query: QueryWorkerDto, @User() user: IUser): Promise<PaginatedWorkerResponseDto> {
    const result = await this.service.findAllWorkers(query, user);
    return this.mapper.mapPaginatedWorkers(result);
  }

  @Get(':id')
  @Endpoint('Get worker by ID', true)
  @ApiOkResponse({ type: WorkerResponseDto })
  async findOneWorker(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<WorkerResponseDto> {
    const result = await this.service.findOneWorker(id, user);
    return this.mapper.mapWorker(result);
  }

  @Patch(':id')
  @Endpoint('Update worker', true)
  @ApiOkResponse({ type: WorkerResponseDto })
  async updateWorker(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkerDto,
    @User() user: IUser,
  ): Promise<WorkerResponseDto> {
    const result = await this.service.updateWorker(id, dto, user);
    return this.mapper.mapWorker(result);
  }

  @Delete(':id')
  @Endpoint('Delete worker', true)
  async removeWorker(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<{ success: boolean }> {
    await this.service.removeWorker(id, user);
    return { success: true };
  }

  @Post('work-logs')
  @Endpoint('Create work log', true)
  @ApiOkResponse({ type: WorkLogResponseDto })
  async createWorkLog(@Body() dto: CreateWorkLogDto, @User() user: IUser): Promise<WorkLogResponseDto> {
    const result = await this.service.createWorkLog(dto, user);
    return this.mapper.mapWorkLog(result);
  }

  @Get('work-logs/list')
  @Endpoint('Get all work logs', true)
  @ApiOkResponse({ type: PaginatedWorkLogResponseDto })
  async findAllWorkLogs(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('workerId') workerId: string,
    @Query('projectId') projectId: string,
    @User() user: IUser,
  ): Promise<PaginatedWorkLogResponseDto> {
    const result = await this.service.findAllWorkLogs(user, page, limit, workerId, projectId);
    return this.mapper.mapPaginatedWorkLogs(result);
  }

  @Get('work-logs/unvalidated')
  @Endpoint('Get unvalidated work logs', true)
  @ApiOkResponse({ type: PaginatedWorkLogResponseDto })
  async findUnvalidatedWorkLogs(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('projectId') projectId: string,
    @User() user: IUser,
  ): Promise<PaginatedWorkLogResponseDto> {
    const result = await this.service.findUnvalidatedWorkLogs(user, page, limit, projectId);
    return this.mapper.mapPaginatedWorkLogs(result);
  }

  @Get('work-logs/:id')
  @Endpoint('Get work log by ID', true)
  @ApiOkResponse({ type: WorkLogResponseDto })
  async findOneWorkLog(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<WorkLogResponseDto> {
    const result = await this.service.findOneWorkLog(id, user);
    return this.mapper.mapWorkLog(result);
  }

  @Post('work-logs/:id/validate')
  @Endpoint('Validate work log', true)
  @ApiOkResponse({ type: WorkLogResponseDto })
  async validateWorkLog(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ValidateWorkLogDto,
    @User() user: IUser,
  ): Promise<WorkLogResponseDto> {
    const result = await this.service.validateWorkLog(id, dto, user);
    return this.mapper.mapWorkLog(result);
  }

  @Delete('work-logs/:id')
  @Endpoint('Delete work log', true)
  async deleteWorkLog(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<{ success: boolean }> {
    await this.service.deleteWorkLog(id, user);
    return { success: true };
  }

  @Post('payments')
  @Endpoint('Create worker payment', true)
  @ApiOkResponse({ type: WorkerPaymentResponseDto })
  async createPayment(@Body() dto: CreateWorkerPaymentDto, @User() user: IUser): Promise<WorkerPaymentResponseDto> {
    const result = await this.service.createPayment(dto, user);
    return this.mapper.mapPayment(result);
  }

  @Get('payments/list')
  @Endpoint('Get all worker payments', true)
  @ApiOkResponse({ type: PaginatedWorkerPaymentResponseDto })
  async findAllPayments(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('workerId') workerId: string,
    @User() user: IUser,
  ): Promise<PaginatedWorkerPaymentResponseDto> {
    const result = await this.service.findAllPayments(user, page, limit, workerId);
    return this.mapper.mapPaginatedPayments(result);
  }

  @Get('payments/:id')
  @Endpoint('Get worker payment by ID', true)
  @ApiOkResponse({ type: WorkerPaymentResponseDto })
  async findOnePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
  ): Promise<WorkerPaymentResponseDto> {
    const result = await this.service.findOnePayment(id, user);
    return this.mapper.mapPayment(result);
  }
}
