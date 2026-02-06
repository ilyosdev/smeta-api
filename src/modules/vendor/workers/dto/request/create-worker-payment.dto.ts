import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateWorkerPaymentDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  workerId: string;

  @ApiProperty()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;
}
