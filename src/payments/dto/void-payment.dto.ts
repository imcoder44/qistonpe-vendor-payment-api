import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class VoidPaymentDto {
  @ApiProperty({
    description: 'Reason for voiding the payment',
    example: 'Payment was made in error - duplicate transaction',
  })
  @IsString()
  @IsNotEmpty({ message: 'Void reason is required' })
  @MaxLength(500)
  voidReason: string;
}
