import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
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
import { PurchaseOrdersService } from './purchase-orders.service';
import {
  CreatePurchaseOrderDto,
  CreatePurchaseOrderItemDto,
  UpdatePurchaseOrderDto,
  UpdatePurchaseOrderItemDto,
  PurchaseOrderQueryDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Purchase Orders')
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly poService: PurchaseOrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new purchase order',
    description: 'Creates a purchase order with line items. Auto-generates PO number and calculates due date based on vendor payment terms.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Purchase order created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input or vendor inactive',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Vendor not found',
  })
  async create(
    @Body() createDto: CreatePurchaseOrderDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.poService.create(createDto, userId);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all purchase orders',
    description: 'Returns paginated list with optional filters for vendor, status, date ranges, and amounts',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of purchase orders with pagination metadata',
  })
  async findAll(@Query() query: PurchaseOrderQueryDto) {
    return this.poService.findAll(query);
  }

  @Get('statistics')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get purchase order statistics',
    description: 'Returns aggregate statistics including totals by status, amounts, and overdue information',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase order statistics',
  })
  async getStatistics() {
    return this.poService.getStatistics();
  }

  @Get('overdue')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get overdue purchase orders',
    description: 'Returns all purchase orders that are past their due date with outstanding balance',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of overdue purchase orders',
  })
  async getOverdue() {
    return this.poService.getOverduePurchaseOrders();
  }

  @Get('by-number/:poNumber')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get purchase order by PO number',
    description: 'Returns a single purchase order by its PO number',
  })
  @ApiParam({
    name: 'poNumber',
    description: 'PO number (e.g., PO-20260114-001)',
    example: 'PO-20260114-001',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase order details',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Purchase order not found',
  })
  async findByPoNumber(@Param('poNumber') poNumber: string) {
    return this.poService.findByPoNumber(poNumber);
  }

  @Get('vendor/:vendorId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get purchase orders by vendor',
    description: 'Returns all purchase orders for a specific vendor',
  })
  @ApiParam({
    name: 'vendorId',
    description: 'Vendor ID (UUID)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of purchase orders for the vendor',
  })
  async findByVendor(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
  ) {
    return this.poService.findByVendor(vendorId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get purchase order by ID',
    description: 'Returns a single purchase order with all related data',
  })
  @ApiParam({
    name: 'id',
    description: 'Purchase order ID (UUID)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase order details with items and payments',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Purchase order not found',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.poService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update purchase order',
    description: 'Updates purchase order details (not items). Cannot modify paid or cancelled POs.',
  })
  @ApiParam({
    name: 'id',
    description: 'Purchase order ID (UUID)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase order updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid status transition or PO cannot be modified',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Purchase order not found',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdatePurchaseOrderDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.poService.update(id, updateDto, userId);
  }

  @Post(':id/items')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add item to purchase order',
    description: 'Adds a new line item to an existing PO. Only works for pending/approved POs.',
  })
  @ApiParam({
    name: 'id',
    description: 'Purchase order ID (UUID)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Item added successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot add items to this PO status',
  })
  async addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() itemDto: CreatePurchaseOrderItemDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.poService.addItem(id, itemDto, userId);
  }

  @Patch(':id/items/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update item in purchase order',
    description: 'Updates an existing line item. Only works for pending/approved POs.',
  })
  @ApiParam({
    name: 'id',
    description: 'Purchase order ID (UUID)',
  })
  @ApiParam({
    name: 'itemId',
    description: 'Item ID (UUID)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Item updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot modify items in this PO status',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Item not found',
  })
  async updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() updateDto: UpdatePurchaseOrderItemDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.poService.updateItem(id, itemId, updateDto, userId);
  }

  @Delete(':id/items/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove item from purchase order',
    description: 'Removes a line item from PO. Cannot remove the last item. Only works for pending/approved POs.',
  })
  @ApiParam({
    name: 'id',
    description: 'Purchase order ID (UUID)',
  })
  @ApiParam({
    name: 'itemId',
    description: 'Item ID (UUID)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Item removed successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot remove item (last item or wrong PO status)',
  })
  async removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.poService.removeItem(id, itemId, userId);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel purchase order',
    description: 'Cancels a purchase order. Cannot cancel if there are payments recorded.',
  })
  @ApiParam({
    name: 'id',
    description: 'Purchase order ID (UUID)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase order cancelled',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot cancel (fully paid or has payments)',
  })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.poService.cancel(id, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete purchase order (soft delete)',
    description: 'Soft deletes a purchase order. Cannot delete if there are payments.',
  })
  @ApiParam({
    name: 'id',
    description: 'Purchase order ID (UUID)',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Purchase order deleted',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot delete PO with payment history',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.poService.remove(id);
  }

  @Post('mark-overdue')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark overdue purchase orders',
    description: 'Manually triggers marking of overdue POs (normally done by scheduler)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns count of POs marked as overdue',
  })
  async markOverdue() {
    const count = await this.poService.markOverduePurchaseOrders();
    return { markedAsOverdue: count };
  }
}
