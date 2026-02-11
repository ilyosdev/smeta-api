import { IsNumber, IsOptional, IsString } from 'class-validator';

export class FulfillRequestDto {
  @IsNumber()
  fulfilledQty: number;

  @IsNumber()
  fulfilledAmount: number;

  @IsString()
  supplierName: string;

  @IsOptional()
  @IsString()
  proofPhotoFileId?: string;
}
