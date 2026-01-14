import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, PaymentQueryDto, VoidPaymentDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Record a new payment',
    description: 'Records a payment against a purchase order. Auto-generates payment reference and updates PO balances.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Payment recorded successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid payment amount or PO status',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Purchase order not found',
  })
  async create(
    @Body() createDto: CreatePaymentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.create(createDto, userId);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all payments',
    description: 'Returns paginated list with optional filters for PO, vendor, date ranges, amounts, and methods',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of payments with pagination metadata',
  })
  async findAll(@Query() query: PaymentQueryDto) {
    return this.paymentsService.findAll(query);
  }

  @Get('statistics')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get payment statistics',
    description: 'Returns aggregate statistics including totals by method, status, and monthly comparisons',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment statistics',
  })
  async getStatistics() {
    return this.paymentsService.getStatistics();
  }

  @Get('trends')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get payment trends (BONUS)',
    description: 'Returns monthly and weekly payment trends for analytics',
  })
  @ApiQuery({
    name: 'months',
    required: false,
    description: 'Number of months to analyze',
    example: 12,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment trends data',
  })
  async getTrends(@Query('months') months?: number) {
    return this.paymentsService.getPaymentTrends(months || 12);
  }

  @Get('by-reference/:reference')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get payment by reference',
    description: 'Returns a single payment by its reference number',
  })
  @ApiParam({
    name: 'reference',
    description: 'Payment reference (e.g., PAY-20260114-001)',
    example: 'PAY-20260114-001',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment details',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Payment not found',
  })
  async findByReference(@Param('reference') reference: string) {
    return this.paymentsService.findByReference(reference);
  }

  @Get('purchase-order/:poId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get payments by purchase order',
    description: 'Returns all payments for a specific purchase order',
  })
  @ApiParam({
    name: 'poId',
    description: 'Purchase order ID (UUID)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of payments for the PO',
  })
  async findByPurchaseOrder(@Param('poId', ParseUUIDPipe) poId: string) {
    return this.paymentsService.findByPurchaseOrder(poId);
  }

  @Get('vendor/:vendorId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get payments by vendor',
    description: 'Returns all payments for a specific vendor across all POs',
  })
  @ApiParam({
    name: 'vendorId',
    description: 'Vendor ID (UUID)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of payments for the vendor',
  })
  async findByVendor(@Param('vendorId', ParseUUIDPipe) vendorId: string) {
    return this.paymentsService.findByVendor(vendorId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get payment by ID',
    description: 'Returns a single payment with related PO and vendor data',
  })
  @ApiParam({
    name: 'id',
    description: 'Payment ID (UUID)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment details',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Payment not found',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findOne(id);
  }

  @Post(':id/void')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Void a payment',
    description: 'Voids a payment and reverses the amount on the PO. Requires a reason.',
  })
  @ApiParam({
    name: 'id',
    description: 'Payment ID (UUID)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment voided successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Payment already voided',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Payment not found',
  })
  async voidPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() voidDto: VoidPaymentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.void(id, voidDto, userId);
  }
}
