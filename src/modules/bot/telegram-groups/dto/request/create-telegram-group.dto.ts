import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTelegramGroupDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;
}
