import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('vendor-outstanding')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get outstanding amounts per vendor',
    description: 'Returns a breakdown of total, paid, outstanding, and overdue amounts for each vendor',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Vendor outstanding report',
  })
  async getVendorOutstanding() {
    return this.analyticsService.getVendorOutstanding();
  }

  @Get('payment-aging')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get payment aging report',
    description: 'Returns overdue payments grouped by aging buckets (1-30, 31-60, 61-90, 90+ days)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment aging report with buckets',
  })
  async getPaymentAging() {
    return this.analyticsService.getPaymentAging();
  }

  @Get('dashboard')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get dashboard summary (BONUS)',
    description: 'Returns comprehensive dashboard statistics for vendors, POs, payments, and outstanding amounts',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dashboard summary',
  })
  async getDashboard() {
    return this.analyticsService.getDashboardSummary();
  }

  @Get('cash-flow-forecast')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get cash flow forecast (BONUS)',
    description: 'Returns upcoming payment obligations grouped by week for cash flow planning',
  })
  @ApiQuery({
    name: 'weeks',
    required: false,
    description: 'Number of weeks to forecast',
    example: 4,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cash flow forecast',
  })
  async getCashFlowForecast(@Query('weeks') weeks?: number) {
    return this.analyticsService.getCashFlowForecast(weeks || 4);
  }

  @Get('top-vendors')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get top vendors by outstanding (BONUS)',
    description: 'Returns top N vendors sorted by outstanding amount',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of vendors to return',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Top vendors by outstanding',
  })
  async getTopVendors(@Query('limit') limit?: number) {
    return this.analyticsService.getTopVendorsByOutstanding(limit || 10);
  }
}
