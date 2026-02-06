import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { IUser, Roles } from 'src/common/consts/auth';
import { Endpoint } from 'src/common/decorators/endpoint';
import { User } from 'src/common/decorators/user';

import {
  CreateUserDto,
  PaginatedUserResponseDto,
  QueryUserDto,
  UpdateUserDto,
  UserResponseDto,
} from './dto';
import { VendorUsersMapper } from './vendor-users.mapper';
import { VendorUsersService } from './vendor-users.service';

@ApiTags('[VENDOR] Users')
@Controller('vendor/users')
export class VendorUsersController {
  constructor(
    private readonly service: VendorUsersService,
    private readonly mapper: VendorUsersMapper,
  ) {}

  @Post()
  @Endpoint('Create user', true, [Roles.BOSS, Roles.DIREKTOR])
  @ApiOkResponse({ type: UserResponseDto })
  async create(@Body() dto: CreateUserDto, @User() user: IUser): Promise<UserResponseDto> {
    const result = await this.service.create(dto, user);
    return this.mapper.mapUser(result);
  }

  @Get()
  @Endpoint('Get all users', true)
  @ApiOkResponse({ type: PaginatedUserResponseDto })
  async findAll(@Query() query: QueryUserDto, @User() user: IUser): Promise<PaginatedUserResponseDto> {
    const result = await this.service.findAll(query, user);
    return this.mapper.mapPaginatedUsers(result);
  }

  @Get(':id')
  @Endpoint('Get user by ID', true)
  @ApiOkResponse({ type: UserResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<UserResponseDto> {
    const result = await this.service.findOne(id, user);
    return this.mapper.mapUser(result);
  }

  @Patch(':id')
  @Endpoint('Update user', true, [Roles.BOSS, Roles.DIREKTOR])
  @ApiOkResponse({ type: UserResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @User() user: IUser,
  ): Promise<UserResponseDto> {
    const result = await this.service.update(id, dto, user);
    return this.mapper.mapUser(result);
  }

  @Delete(':id')
  @Endpoint('Delete user', true, [Roles.BOSS])
  async remove(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser): Promise<{ success: boolean }> {
    await this.service.remove(id, user);
    return { success: true };
  }
}
