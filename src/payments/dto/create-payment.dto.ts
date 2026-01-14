import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsDate,
  IsNumber,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../../common/enums';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'Purchase order ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'Invalid purchase order ID format' })
  @IsNotEmpty({ message: 'Purchase order ID is required' })
  purchaseOrderId: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 5000.00,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'Payment amount must be positive' })
  amountPaid: number;

  @ApiPropertyOptional({
    description: 'Payment date (defaults to today)',
    example: '2026-01-14',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paymentDate?: Date;

  @ApiProperty({
    description: 'Payment method',
    enum: PaymentMethod,
    example: PaymentMethod.BANK_TRANSFER,
  })
  @IsEnum(PaymentMethod, { message: 'Invalid payment method' })
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Transaction reference from bank/payment provider',
    example: 'TXN123456789',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transactionReference?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Partial payment for Q1 invoices',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Bank name (for bank transfers)',
    example: 'HDFC Bank',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;

  @ApiPropertyOptional({
    description: 'Cheque number (for cheque payments)',
    example: 'CHQ-001234',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  chequeNumber?: string;
}
