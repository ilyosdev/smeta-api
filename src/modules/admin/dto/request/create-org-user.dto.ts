import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

import { UserRole } from 'src/common/database/schemas';

export class CreateOrgUserDto {
  @ApiProperty({ description: 'User name', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Phone number', example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ description: 'Password (min 6 chars)', example: 'secret123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    enum: [UserRole.BOSS, UserRole.DIREKTOR, UserRole.BUGALTERIYA, UserRole.PTO, UserRole.SNABJENIYA, UserRole.SKLAD, UserRole.PRORAB],
    description: 'User role within organization',
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ description: 'Telegram ID', example: '123456789' })
  @IsString()
  @IsOptional()
  telegramId?: string;
}
