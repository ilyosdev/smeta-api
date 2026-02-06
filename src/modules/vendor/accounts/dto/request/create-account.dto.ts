import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;
}
