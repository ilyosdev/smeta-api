import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  phone: string | null;

  @ApiPropertyOptional()
  specialty: string | null;

  @ApiProperty()
  totalEarned: number;

  @ApiProperty()
  totalPaid: number;

  @ApiProperty()
  balance: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class WorkLogResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workType: string;

  @ApiProperty()
  unit: string;

  @ApiProperty()
  quantity: number;

  @ApiPropertyOptional()
  unitPrice: number | null;

  @ApiPropertyOptional()
  totalAmount: number | null;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  isValidated: boolean;

  @ApiPropertyOptional()
  validatedAt: Date | null;

  @ApiPropertyOptional()
  worker?: { id: string; name: string };

  @ApiPropertyOptional()
  project?: { id: string; name: string };

  @ApiPropertyOptional()
  smetaItem?: { id: string; name: string };

  @ApiProperty()
  loggedBy: { id: string; name: string };

  @ApiPropertyOptional()
  validatedBy?: { id: string; name: string } | null;

  @ApiProperty()
  createdAt: Date;
}

export class WorkerPaymentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  amount: number;

  @ApiPropertyOptional()
  note: string | null;

  @ApiProperty()
  worker: { id: string; name: string };

  @ApiProperty()
  paidBy: { id: string; name: string };

  @ApiProperty()
  createdAt: Date;
}

export class PaginatedWorkerResponseDto {
  @ApiProperty({ type: [WorkerResponseDto] })
  data: WorkerResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class PaginatedWorkLogResponseDto {
  @ApiProperty({ type: [WorkLogResponseDto] })
  data: WorkLogResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class PaginatedWorkerPaymentResponseDto {
  @ApiProperty({ type: [WorkerPaymentResponseDto] })
  data: WorkerPaymentResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
