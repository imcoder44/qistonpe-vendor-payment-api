import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, LessThan, MoreThanOrEqual, Like, In } from 'typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import {
  CreatePurchaseOrderDto,
  CreatePurchaseOrderItemDto,
  UpdatePurchaseOrderDto,
  UpdatePurchaseOrderItemDto,
  PurchaseOrderQueryDto,
} from './dto';
import { PurchaseOrderStatus, PaymentTerms, VendorStatus } from '../common/enums';

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly poRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly poItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(Vendor)
    private readonly vendorRepository: Repository<Vendor>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Generate unique PO number in format: PO-YYYYMMDD-XXX
   */
  private async generatePoNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const prefix = `PO-${dateStr}`;

    // Find the latest PO for today
    const latestPo = await this.poRepository
      .createQueryBuilder('po')
      .where('po.poNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('po.poNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (latestPo) {
      const lastSequence = parseInt(latestPo.poNumber.split('-')[2], 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(3, '0')}`;
  }

  /**
   * Calculate due date based on vendor payment terms
   */
  private calculateDueDate(poDate: Date, paymentTerms: PaymentTerms): Date {
    const daysMap: Record<PaymentTerms, number> = {
      [PaymentTerms.NET_15]: 15,
      [PaymentTerms.NET_30]: 30,
      [PaymentTerms.NET_45]: 45,
      [PaymentTerms.NET_60]: 60,
      [PaymentTerms.IMMEDIATE]: 0,
      [PaymentTerms.ADVANCE]: -7, // 7 days before
    };

    const dueDate = new Date(poDate);
    dueDate.setDate(dueDate.getDate() + daysMap[paymentTerms]);
    return dueDate;
  }

  /**
   * Calculate item total price including tax and discount
   */
  private calculateItemTotal(item: CreatePurchaseOrderItemDto): number {
    const subtotal = item.quantity * item.unitPrice;
    const discount = subtotal * ((item.discountPercent || 0) / 100);
    const afterDiscount = subtotal - discount;
    const tax = afterDiscount * ((item.taxRate || 0) / 100);
    return Number((afterDiscount + tax).toFixed(2));
  }

  /**
   * Create a new purchase order
   */
  async create(createDto: CreatePurchaseOrderDto, userId?: string): Promise<PurchaseOrder> {
    // Validate vendor exists and is active
    const vendor = await this.vendorRepository.findOne({
      where: { id: createDto.vendorId },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${createDto.vendorId} not found`);
    }

    if (vendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException(`Cannot create PO for vendor with status: ${vendor.status}`);
    }

    // Use transaction for data integrity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate unique PO number
      const poNumber = await this.generatePoNumber();
      const poDate = createDto.poDate || new Date();
      const dueDate = this.calculateDueDate(poDate, vendor.paymentTerms);

      // Calculate totals from items
      let subtotal = 0;
      let totalTax = 0;
      let totalDiscount = 0;

      const itemEntities: PurchaseOrderItem[] = [];

      for (const itemDto of createDto.items) {
        const itemSubtotal = itemDto.quantity * itemDto.unitPrice;
        const itemDiscount = itemSubtotal * ((itemDto.discountPercent || 0) / 100);
        const afterDiscount = itemSubtotal - itemDiscount;
        const itemTax = afterDiscount * ((itemDto.taxRate || 0) / 100);
        const itemTotal = afterDiscount + itemTax;

        subtotal += itemSubtotal;
        totalDiscount += itemDiscount;
        totalTax += itemTax;

        const item = this.poItemRepository.create({
          ...itemDto,
          totalPrice: Number(itemTotal.toFixed(2)),
        });
        itemEntities.push(item);
      }

      // Use provided tax/discount or calculated
      const finalTax = createDto.taxAmount ?? Number(totalTax.toFixed(2));
      const finalDiscount = createDto.discountAmount ?? Number(totalDiscount.toFixed(2));
      const totalAmount = Number((subtotal - finalDiscount + finalTax).toFixed(2));

      // Create PO
      const purchaseOrder = this.poRepository.create({
        poNumber,
        vendor,
        poDate,
        dueDate,
        totalAmount,
        paidAmount: 0,
        outstandingAmount: totalAmount,
        taxAmount: finalTax,
        discountAmount: finalDiscount,
        subtotal: Number(subtotal.toFixed(2)),
        status: PurchaseOrderStatus.PENDING,
        notes: createDto.notes,
        referenceNumber: createDto.referenceNumber,
        shippingAddress: createDto.shippingAddress,
        billingAddress: createDto.billingAddress,
        createdBy: userId,
      });

      const savedPo = await queryRunner.manager.save(purchaseOrder) as PurchaseOrder;

      // Link items to PO and save
      for (const item of itemEntities) {
        item.purchaseOrder = savedPo;
        if (userId) item.createdBy = userId;
        await queryRunner.manager.save(item);
      }

      await queryRunner.commitTransaction();

      this.logger.log(`Created PO ${poNumber} for vendor ${vendor.name}`);

      // Fetch and return with relations
      return this.findOne(savedPo.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create PO: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Find all purchase orders with pagination and filters
   */
  async findAll(query: PurchaseOrderQueryDto): Promise<{
    data: PurchaseOrder[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {
    const {
      page = 1,
      limit = 10,
      vendorId,
      status,
      search,
      startDate,
      endDate,
      dueDateStart,
      dueDateEnd,
      overdue,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const qb = this.poRepository
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.vendor', 'vendor')
      .leftJoinAndSelect('po.items', 'items');

    // Apply filters
    if (vendorId) {
      qb.andWhere('vendor.id = :vendorId', { vendorId });
    }

    if (status) {
      qb.andWhere('po.status = :status', { status });
    }

    if (search) {
      qb.andWhere(
        '(po.poNumber LIKE :search OR po.referenceNumber LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (startDate && endDate) {
      qb.andWhere('po.poDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      qb.andWhere('po.poDate >= :startDate', { startDate });
    } else if (endDate) {
      qb.andWhere('po.poDate <= :endDate', { endDate });
    }

    if (dueDateStart && dueDateEnd) {
      qb.andWhere('po.dueDate BETWEEN :dueDateStart AND :dueDateEnd', {
        dueDateStart,
        dueDateEnd,
      });
    } else if (dueDateStart) {
      qb.andWhere('po.dueDate >= :dueDateStart', { dueDateStart });
    } else if (dueDateEnd) {
      qb.andWhere('po.dueDate <= :dueDateEnd', { dueDateEnd });
    }

    if (overdue) {
      const today = new Date();
      qb.andWhere('po.dueDate < :today', { today });
      qb.andWhere('po.outstandingAmount > 0');
      qb.andWhere('po.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: [PurchaseOrderStatus.PAID, PurchaseOrderStatus.CANCELLED],
      });
    }

    if (minAmount !== undefined) {
      qb.andWhere('po.totalAmount >= :minAmount', { minAmount });
    }

    if (maxAmount !== undefined) {
      qb.andWhere('po.totalAmount <= :maxAmount', { maxAmount });
    }

    // Apply sorting
    const validSortFields = ['poNumber', 'poDate', 'dueDate', 'totalAmount', 'outstandingAmount', 'createdAt', 'status'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    qb.orderBy(`po.${sortField}`, sortOrder);

    // Get total count
    const total = await qb.getCount();

    // Apply pagination
    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const data = await qb.getMany();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Find single purchase order by ID
   */
  async findOne(id: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.poRepository.findOne({
      where: { id },
      relations: ['vendor', 'items', 'payments'],
    });

    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }

    return purchaseOrder;
  }

  /**
   * Find purchase order by PO number
   */
  async findByPoNumber(poNumber: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.poRepository.findOne({
      where: { poNumber },
      relations: ['vendor', 'items', 'payments'],
    });

    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase order ${poNumber} not found`);
    }

    return purchaseOrder;
  }

  /**
   * Update purchase order
   */
  async update(
    id: string,
    updateDto: UpdatePurchaseOrderDto,
    userId?: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(id);

    // Validate status transitions
    if (updateDto.status) {
      this.validateStatusTransition(purchaseOrder.status, updateDto.status);
    }

    // Cannot modify paid or cancelled POs (except notes)
    if (
      purchaseOrder.status === PurchaseOrderStatus.PAID ||
      purchaseOrder.status === PurchaseOrderStatus.CANCELLED
    ) {
      if (Object.keys(updateDto).some(key => key !== 'notes')) {
        throw new BadRequestException(
          `Cannot modify ${purchaseOrder.status.toLowerCase()} purchase order`,
        );
      }
    }

    Object.assign(purchaseOrder, updateDto);
    if (userId) purchaseOrder.updatedBy = userId;

    await this.poRepository.save(purchaseOrder);

    this.logger.log(`Updated PO ${purchaseOrder.poNumber}`);

    return this.findOne(id);
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(
    currentStatus: PurchaseOrderStatus,
    newStatus: PurchaseOrderStatus,
  ): void {
    const validTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
      [PurchaseOrderStatus.PENDING]: [
        PurchaseOrderStatus.APPROVED,
        PurchaseOrderStatus.CANCELLED,
      ],
      [PurchaseOrderStatus.APPROVED]: [
        PurchaseOrderStatus.PARTIALLY_PAID,
        PurchaseOrderStatus.PAID,
        PurchaseOrderStatus.CANCELLED,
      ],
      [PurchaseOrderStatus.PARTIALLY_PAID]: [
        PurchaseOrderStatus.PAID,
        PurchaseOrderStatus.CANCELLED,
      ],
      [PurchaseOrderStatus.PAID]: [],
      [PurchaseOrderStatus.CANCELLED]: [],
      [PurchaseOrderStatus.OVERDUE]: [
        PurchaseOrderStatus.PARTIALLY_PAID,
        PurchaseOrderStatus.PAID,
        PurchaseOrderStatus.CANCELLED,
      ],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  /**
   * Add item to existing PO
   */
  async addItem(
    poId: string,
    itemDto: CreatePurchaseOrderItemDto,
    userId?: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(poId);

    if (
      purchaseOrder.status !== PurchaseOrderStatus.PENDING &&
      purchaseOrder.status !== PurchaseOrderStatus.APPROVED
    ) {
      throw new BadRequestException(
        `Cannot add items to ${purchaseOrder.status.toLowerCase()} purchase order`,
      );
    }

    // Calculate item total
    const itemTotal = this.calculateItemTotal(itemDto);

    const item = this.poItemRepository.create({
      ...itemDto,
      totalPrice: itemTotal,
      purchaseOrder,
      createdBy: userId,
    });

    await this.poItemRepository.save(item);

    // Recalculate PO totals
    await this.recalculateTotals(poId, userId);

    return this.findOne(poId);
  }

  /**
   * Update item in PO
   */
  async updateItem(
    poId: string,
    itemId: string,
    updateDto: UpdatePurchaseOrderItemDto,
    userId?: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(poId);

    if (
      purchaseOrder.status !== PurchaseOrderStatus.PENDING &&
      purchaseOrder.status !== PurchaseOrderStatus.APPROVED
    ) {
      throw new BadRequestException(
        `Cannot modify items in ${purchaseOrder.status.toLowerCase()} purchase order`,
      );
    }

    const item = purchaseOrder.items.find(i => i.id === itemId);
    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found in this PO`);
    }

    Object.assign(item, updateDto);
    if (userId) item.updatedBy = userId;

    // Recalculate item total
    item.totalPrice = this.calculateItemTotal({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      discountPercent: item.discountPercent,
      description: item.description,
    });

    await this.poItemRepository.save(item);

    // Recalculate PO totals
    await this.recalculateTotals(poId, userId);

    return this.findOne(poId);
  }

  /**
   * Remove item from PO
   */
  async removeItem(poId: string, itemId: string, userId?: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(poId);

    if (
      purchaseOrder.status !== PurchaseOrderStatus.PENDING &&
      purchaseOrder.status !== PurchaseOrderStatus.APPROVED
    ) {
      throw new BadRequestException(
        `Cannot remove items from ${purchaseOrder.status.toLowerCase()} purchase order`,
      );
    }

    if (purchaseOrder.items.length <= 1) {
      throw new BadRequestException('Cannot remove the last item from a PO');
    }

    const item = purchaseOrder.items.find(i => i.id === itemId);
    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found in this PO`);
    }

    await this.poItemRepository.remove(item);

    // Recalculate PO totals
    await this.recalculateTotals(poId, userId);

    return this.findOne(poId);
  }

  /**
   * Recalculate PO totals based on items
   */
  private async recalculateTotals(poId: string, userId?: string): Promise<void> {
    const purchaseOrder = await this.findOne(poId);

    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    for (const item of purchaseOrder.items) {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemDiscount = itemSubtotal * ((item.discountPercent || 0) / 100);
      const afterDiscount = itemSubtotal - itemDiscount;
      const itemTax = afterDiscount * ((item.taxRate || 0) / 100);

      subtotal += itemSubtotal;
      totalDiscount += itemDiscount;
      totalTax += itemTax;
    }

    const totalAmount = subtotal - totalDiscount + totalTax;
    const outstandingAmount = totalAmount - purchaseOrder.paidAmount;

    await this.poRepository.update(poId, {
      subtotal: Number(subtotal.toFixed(2)),
      taxAmount: Number(totalTax.toFixed(2)),
      discountAmount: Number(totalDiscount.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
      outstandingAmount: Number(outstandingAmount.toFixed(2)),
      updatedBy: userId,
    });
  }

  /**
   * Cancel a purchase order
   */
  async cancel(id: string, userId?: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(id);

    if (purchaseOrder.status === PurchaseOrderStatus.PAID) {
      throw new BadRequestException('Cannot cancel a fully paid purchase order');
    }

    if (purchaseOrder.paidAmount > 0) {
      throw new BadRequestException(
        'Cannot cancel PO with payments. Void payments first.',
      );
    }

    purchaseOrder.status = PurchaseOrderStatus.CANCELLED;
    if (userId) purchaseOrder.updatedBy = userId;

    await this.poRepository.save(purchaseOrder);

    this.logger.log(`Cancelled PO ${purchaseOrder.poNumber}`);

    return purchaseOrder;
  }

  /**
   * Soft delete a purchase order
   */
  async remove(id: string): Promise<void> {
    const purchaseOrder = await this.findOne(id);

    if (purchaseOrder.paidAmount > 0) {
      throw new BadRequestException(
        'Cannot delete PO with payment history. Cancel it instead.',
      );
    }

    await this.poRepository.softRemove(purchaseOrder);

    this.logger.log(`Soft deleted PO ${purchaseOrder.poNumber}`);
  }

  /**
   * Get purchase orders for a specific vendor
   */
  async findByVendor(vendorId: string): Promise<PurchaseOrder[]> {
    return this.poRepository.find({
      where: { vendor: { id: vendorId } },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get overdue purchase orders
   */
  async getOverduePurchaseOrders(): Promise<PurchaseOrder[]> {
    const today = new Date();
    
    return this.poRepository.find({
      where: {
        dueDate: LessThan(today),
        status: In([
          PurchaseOrderStatus.PENDING,
          PurchaseOrderStatus.APPROVED,
          PurchaseOrderStatus.PARTIALLY_PAID,
          PurchaseOrderStatus.OVERDUE,
        ]),
      },
      relations: ['vendor'],
      order: { dueDate: 'ASC' },
    });
  }

  /**
   * Mark overdue POs - to be called by scheduler
   */
  async markOverduePurchaseOrders(): Promise<number> {
    const today = new Date();
    
    const result = await this.poRepository
      .createQueryBuilder()
      .update(PurchaseOrder)
      .set({ status: PurchaseOrderStatus.OVERDUE })
      .where('dueDate < :today', { today })
      .andWhere('status IN (:...statuses)', {
        statuses: [
          PurchaseOrderStatus.PENDING,
          PurchaseOrderStatus.APPROVED,
          PurchaseOrderStatus.PARTIALLY_PAID,
        ],
      })
      .andWhere('outstandingAmount > 0')
      .execute();

    const affectedCount = result.affected ?? 0;
    if (affectedCount > 0) {
      this.logger.log(`Marked ${affectedCount} POs as overdue`);
    }

    return affectedCount;
  }

  /**
   * Update payment amounts (called by PaymentsService)
   */
  async updatePaymentAmounts(
    poId: string,
    additionalPayment: number,
    userId?: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(poId);

    const newPaidAmount = Number((purchaseOrder.paidAmount + additionalPayment).toFixed(2));
    const newOutstanding = Number((purchaseOrder.totalAmount - newPaidAmount).toFixed(2));

    if (newPaidAmount > purchaseOrder.totalAmount) {
      throw new BadRequestException(
        `Payment would exceed total amount. Maximum payment: ${purchaseOrder.outstandingAmount}`,
      );
    }

    // Determine new status
    let newStatus = purchaseOrder.status;
    if (newOutstanding <= 0) {
      newStatus = PurchaseOrderStatus.PAID;
    } else if (newPaidAmount > 0) {
      newStatus = PurchaseOrderStatus.PARTIALLY_PAID;
    }

    purchaseOrder.paidAmount = newPaidAmount;
    purchaseOrder.outstandingAmount = Math.max(0, newOutstanding);
    purchaseOrder.status = newStatus;
    if (userId) purchaseOrder.updatedBy = userId;

    await this.poRepository.save(purchaseOrder);

    this.logger.log(
      `Updated PO ${purchaseOrder.poNumber} - Paid: ${newPaidAmount}, Outstanding: ${purchaseOrder.outstandingAmount}`,
    );

    return purchaseOrder;
  }

  /**
   * Reverse payment amount (when voiding payment)
   */
  async reversePaymentAmount(
    poId: string,
    amount: number,
    userId?: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(poId);

    const newPaidAmount = Number((purchaseOrder.paidAmount - amount).toFixed(2));
    const newOutstanding = Number((purchaseOrder.totalAmount - newPaidAmount).toFixed(2));

    // Determine new status
    let newStatus = purchaseOrder.status;
    if (newPaidAmount <= 0) {
      // Check if overdue
      if (new Date() > purchaseOrder.dueDate) {
        newStatus = PurchaseOrderStatus.OVERDUE;
      } else {
        newStatus = PurchaseOrderStatus.APPROVED;
      }
    } else {
      newStatus = PurchaseOrderStatus.PARTIALLY_PAID;
    }

    purchaseOrder.paidAmount = Math.max(0, newPaidAmount);
    purchaseOrder.outstandingAmount = newOutstanding;
    purchaseOrder.status = newStatus;
    if (userId) purchaseOrder.updatedBy = userId;

    await this.poRepository.save(purchaseOrder);

    this.logger.log(
      `Reversed payment on PO ${purchaseOrder.poNumber} - Paid: ${purchaseOrder.paidAmount}, Outstanding: ${purchaseOrder.outstandingAmount}`,
    );

    return purchaseOrder;
  }

  /**
   * Get PO statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalAmount: number;
    totalPaid: number;
    totalOutstanding: number;
    overdueCount: number;
    overdueAmount: number;
  }> {
    const stats = await this.poRepository
      .createQueryBuilder('po')
      .select([
        'COUNT(po.id) as total',
        'SUM(po.totalAmount) as totalAmount',
        'SUM(po.paidAmount) as totalPaid',
        'SUM(po.outstandingAmount) as totalOutstanding',
      ])
      .getRawOne();

    const statusCounts = await this.poRepository
      .createQueryBuilder('po')
      .select(['po.status as status', 'COUNT(po.id) as count'])
      .groupBy('po.status')
      .getRawMany();

    const byStatus: Record<string, number> = {};
    for (const sc of statusCounts) {
      byStatus[sc.status] = parseInt(sc.count, 10);
    }

    const overdueStats = await this.poRepository
      .createQueryBuilder('po')
      .select([
        'COUNT(po.id) as count',
        'SUM(po.outstandingAmount) as amount',
      ])
      .where('po.dueDate < :today', { today: new Date() })
      .andWhere('po.outstandingAmount > 0')
      .andWhere('po.status NOT IN (:...excluded)', {
        excluded: [PurchaseOrderStatus.PAID, PurchaseOrderStatus.CANCELLED],
      })
      .getRawOne();

    return {
      total: parseInt(stats.total, 10) || 0,
      byStatus,
      totalAmount: parseFloat(stats.totalAmount) || 0,
      totalPaid: parseFloat(stats.totalPaid) || 0,
      totalOutstanding: parseFloat(stats.totalOutstanding) || 0,
      overdueCount: parseInt(overdueStats.count, 10) || 0,
      overdueAmount: parseFloat(overdueStats.amount) || 0,
    };
  }
}
