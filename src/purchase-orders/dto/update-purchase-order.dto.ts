import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType, OmitType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDate,
  IsNumber,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePurchaseOrderDto } from './create-purchase-order.dto';
import { PurchaseOrderStatus } from '../../common/enums';

// Can't update vendorId or items directly (use separate endpoints)
export class UpdatePurchaseOrderDto extends PartialType(
  OmitType(CreatePurchaseOrderDto, ['vendorId', 'items'] as const),
) {
  @ApiPropertyOptional({
    description: 'Purchase order status',
    enum: PurchaseOrderStatus,
    example: PurchaseOrderStatus.APPROVED,
  })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional({
    description: 'Override due date',
    example: '2026-02-14',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;
}

export class UpdatePurchaseOrderItemDto {
  @ApiPropertyOptional({
    description: 'Item description',
    example: 'Office Supplies - A4 Paper',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    description: 'Quantity',
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Unit price',
    example: 500.00,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

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
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional({
    description: 'Discount percentage',
    example: 5,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountPercent?: number;
}
