import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsDate,
  IsNumber,
  IsArray,
  IsOptional,
  IsNotEmpty,
  ValidateNested,
  Min,
  IsPositive,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePurchaseOrderItemDto {
  @ApiProperty({
    description: 'Item description',
    example: 'Office Supplies - A4 Paper',
  })
  @IsString()
  @IsNotEmpty({ message: 'Item description is required' })
  @MaxLength(255)
  description: string;

  @ApiProperty({
    description: 'Quantity',
    example: 10,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive({ message: 'Quantity must be a positive number' })
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Unit price',
    example: 500.00,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'Unit price must be a positive number' })
  unitPrice: number;

  @ApiPropertyOptional({
    description: 'Unit of measurement',
    example: 'boxes',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional({
    description: 'Item code/SKU',
    example: 'OFF-A4-001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  itemCode?: string;

  @ApiPropertyOptional({
    description: 'Tax rate percentage',
    example: 18,
    default: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional({
    description: 'Discount percentage',
    example: 5,
    default: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountPercent?: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({
    description: 'Vendor ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'Invalid vendor ID format' })
  @IsNotEmpty({ message: 'Vendor ID is required' })
  vendorId: string;

  @ApiPropertyOptional({
    description: 'Purchase order date (defaults to today)',
    example: '2026-01-14',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  poDate?: Date;

  @ApiProperty({
    description: 'Line items for the purchase order',
    type: [CreatePurchaseOrderItemDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one item is required' })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Urgent delivery required',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'External reference number',
    example: 'REF-2026-001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @ApiPropertyOptional({
    description: 'Shipping address',
    example: '456 Warehouse Rd, Mumbai 400001',
  })
  @IsOptional()
  @IsString()
  shippingAddress?: string;

  @ApiPropertyOptional({
    description: 'Billing address',
    example: '123 Business Park, Mumbai 400001',
  })
  @IsOptional()
  @IsString()
  billingAddress?: string;

  @ApiPropertyOptional({
    description: 'Tax amount (auto-calculated if not provided)',
    example: 900.00,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({
    description: 'Discount amount',
    example: 250.00,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;
}
