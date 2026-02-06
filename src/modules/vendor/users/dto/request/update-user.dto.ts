import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

import { UserRole } from 'src/common/database/schemas';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'User name', example: 'John Doe' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+998901234567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Email address', example: 'john@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Password (min 6 chars)', example: 'secret123' })
  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ description: 'Telegram ID', example: '123456789' })
  @IsString()
  @IsOptional()
  telegramId?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Is user active', example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
