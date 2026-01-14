import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { VendorStatus, PaymentTerms } from '../../common/enums';

export class CreateVendorDto {
  @ApiProperty({
    description: 'Unique vendor name',
    example: 'ABC Suppliers Pvt Ltd',
    minLength: 2,
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty({ message: 'Vendor name is required' })
  @MinLength(2, { message: 'Vendor name must be at least 2 characters' })
  @MaxLength(255, { message: 'Vendor name cannot exceed 255 characters' })
  name: string;

  @ApiPropertyOptional({
    description: 'Contact person name',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactPerson?: string;

  @ApiProperty({
    description: 'Vendor email address (unique)',
    example: 'supplier@abc.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+91-9876543210',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[\d\s\-\+\(\)]+$/, {
    message: 'Phone number can only contain digits, spaces, and +-()',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Payment terms in days',
    enum: PaymentTerms,
    example: PaymentTerms.NET_30,
    default: PaymentTerms.NET_30,
  })
  @IsOptional()
  @IsEnum(PaymentTerms, {
    message: 'Payment terms must be one of: 7, 15, 30, 45, or 60 days',
  })
  paymentTerms?: PaymentTerms;

  @ApiPropertyOptional({
    description: 'Vendor status',
    enum: VendorStatus,
    example: VendorStatus.ACTIVE,
    default: VendorStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(VendorStatus, {
    message: 'Status must be either Active or Inactive',
  })
  status?: VendorStatus;

  @ApiPropertyOptional({
    description: 'Vendor address',
    example: '123 Business Park, Mumbai, Maharashtra 400001',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'GST Number',
    example: '27AABCU9603R1ZX',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'Invalid GST number format',
  })
  gstNumber?: string;

  @ApiPropertyOptional({
    description: 'PAN Number',
    example: 'AABCU9603R',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'Invalid PAN number format',
  })
  panNumber?: string;

  @ApiPropertyOptional({
    description: 'Bank account number',
    example: '123456789012',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bankAccountNumber?: string;

  @ApiPropertyOptional({
    description: 'Bank IFSC code',
    example: 'SBIN0001234',
  })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message: 'Invalid IFSC code format',
  })
  bankIfscCode?: string;

  @ApiPropertyOptional({
    description: 'Bank name',
    example: 'State Bank of India',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;
}
