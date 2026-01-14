import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import { CreatePaymentDto, PaymentQueryDto, VoidPaymentDto } from './dto';
import { PaymentStatus, PurchaseOrderStatus } from '../common/enums';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PurchaseOrder)
    private readonly poRepository: Repository<PurchaseOrder>,
    private readonly poService: PurchaseOrdersService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Generate unique payment reference: PAY-YYYYMMDD-XXX
   */
  private async generatePaymentReference(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const prefix = `PAY-${dateStr}`;

    const latestPayment = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.paymentReference LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('payment.paymentReference', 'DESC')
      .getOne();

    let sequence = 1;
    if (latestPayment) {
      const lastSequence = parseInt(latestPayment.paymentReference.split('-')[2], 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(3, '0')}`;
  }

  /**
   * Record a new payment
   */
  async create(createDto: CreatePaymentDto, userId?: string): Promise<Payment> {
    // Get the PO and validate
    const purchaseOrder = await this.poService.findOne(createDto.purchaseOrderId);

    // Validate PO status
    if (purchaseOrder.status === PurchaseOrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot record payment for cancelled PO');
    }

    if (purchaseOrder.status === PurchaseOrderStatus.PAID) {
      throw new BadRequestException('PO is already fully paid');
    }

    if (purchaseOrder.status === PurchaseOrderStatus.PENDING) {
      throw new BadRequestException('PO must be approved before recording payments');
    }

    // Validate payment amount
    if (createDto.amountPaid > purchaseOrder.outstandingAmount) {
      throw new BadRequestException(
        `Payment amount exceeds outstanding balance. Maximum: ₹${purchaseOrder.outstandingAmount.toFixed(2)}`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate payment reference
      const paymentReference = await this.generatePaymentReference();

      // Create payment record
      const payment = this.paymentRepository.create({
        paymentReference,
        purchaseOrder,
        paymentDate: createDto.paymentDate || new Date(),
        amountPaid: createDto.amountPaid,
        paymentMethod: createDto.paymentMethod,
        status: PaymentStatus.COMPLETED,
        transactionReference: createDto.transactionReference,
        notes: createDto.notes,
        bankName: createDto.bankName,
        chequeNumber: createDto.chequeNumber,
        createdBy: userId,
      });

      const savedPayment = await queryRunner.manager.save(payment);

      // Update PO payment amounts
      await this.poService.updatePaymentAmounts(
        purchaseOrder.id,
        createDto.amountPaid,
        userId,
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `Payment ${paymentReference} recorded: ₹${createDto.amountPaid} for PO ${purchaseOrder.poNumber}`,
      );

      // Return with relations
      return this.findOne(savedPayment.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to record payment: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get all payments with pagination and filters
   */
  async findAll(query: PaymentQueryDto): Promise<{
    data: Payment[];
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
      purchaseOrderId,
      vendorId,
      paymentMethod,
      status,
      search,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.purchaseOrder', 'po')
      .leftJoinAndSelect('po.vendor', 'vendor');

    // Apply filters
    if (purchaseOrderId) {
      qb.andWhere('po.id = :purchaseOrderId', { purchaseOrderId });
    }

    if (vendorId) {
      qb.andWhere('vendor.id = :vendorId', { vendorId });
    }

    if (paymentMethod) {
      qb.andWhere('payment.paymentMethod = :paymentMethod', { paymentMethod });
    }

    if (status) {
      qb.andWhere('payment.status = :status', { status });
    }

    if (search) {
      qb.andWhere(
        '(payment.paymentReference LIKE :search OR payment.transactionReference LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (startDate && endDate) {
      qb.andWhere('payment.paymentDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      qb.andWhere('payment.paymentDate >= :startDate', { startDate });
    } else if (endDate) {
      qb.andWhere('payment.paymentDate <= :endDate', { endDate });
    }

    if (minAmount !== undefined) {
      qb.andWhere('payment.amountPaid >= :minAmount', { minAmount });
    }

    if (maxAmount !== undefined) {
      qb.andWhere('payment.amountPaid <= :maxAmount', { maxAmount });
    }

    // Apply sorting
    const validSortFields = ['paymentReference', 'paymentDate', 'amountPaid', 'createdAt', 'status'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    qb.orderBy(`payment.${sortField}`, sortOrder);

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
   * Find single payment by ID
   */
  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['purchaseOrder', 'purchaseOrder.vendor'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  /**
   * Find payment by reference
   */
  async findByReference(paymentReference: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { paymentReference },
      relations: ['purchaseOrder', 'purchaseOrder.vendor'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentReference} not found`);
    }

    return payment;
  }

  /**
   * Void a payment
   */
  async void(id: string, voidDto: VoidPaymentDto, userId?: string): Promise<Payment> {
    const payment = await this.findOne(id);

    if (payment.status === PaymentStatus.VOIDED) {
      throw new BadRequestException('Payment is already voided');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update payment status
      payment.status = PaymentStatus.VOIDED;
      payment.voidedAt = new Date();
      payment.voidReason = voidDto.voidReason;
      if (userId) {
        payment.voidedBy = userId;
        payment.updatedBy = userId;
      }

      await queryRunner.manager.save(payment);

      // Reverse the payment amount on PO
      await this.poService.reversePaymentAmount(
        payment.purchaseOrder.id,
        payment.amountPaid,
        userId,
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `Payment ${payment.paymentReference} voided: ${voidDto.voidReason}`,
      );

      return this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to void payment: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get payments for a purchase order
   */
  async findByPurchaseOrder(poId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { purchaseOrder: { id: poId } },
      order: { paymentDate: 'DESC' },
    });
  }

  /**
   * Get payments for a vendor
   */
  async findByVendor(vendorId: string): Promise<Payment[]> {
    return this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.purchaseOrder', 'po')
      .leftJoin('po.vendor', 'vendor')
      .where('vendor.id = :vendorId', { vendorId })
      .orderBy('payment.paymentDate', 'DESC')
      .getMany();
  }

  /**
   * Get payment statistics
   */
  async getStatistics(): Promise<{
    totalPayments: number;
    totalAmount: number;
    byMethod: Record<string, { count: number; amount: number }>;
    byStatus: Record<string, number>;
    recentPayments: Payment[];
    averagePaymentAmount: number;
    thisMonthTotal: number;
    lastMonthTotal: number;
  }> {
    // Overall stats
    const overallStats = await this.paymentRepository
      .createQueryBuilder('payment')
      .select([
        'COUNT(payment.id) as totalPayments',
        'SUM(payment.amountPaid) as totalAmount',
        'AVG(payment.amountPaid) as avgAmount',
      ])
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .getRawOne();

    // By payment method
    const methodStats = await this.paymentRepository
      .createQueryBuilder('payment')
      .select([
        'payment.paymentMethod as method',
        'COUNT(payment.id) as count',
        'SUM(payment.amountPaid) as amount',
      ])
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .groupBy('payment.paymentMethod')
      .getRawMany();

    const byMethod: Record<string, { count: number; amount: number }> = {};
    for (const ms of methodStats) {
      byMethod[ms.method] = {
        count: parseInt(ms.count, 10),
        amount: parseFloat(ms.amount) || 0,
      };
    }

    // By status
    const statusStats = await this.paymentRepository
      .createQueryBuilder('payment')
      .select(['payment.status as status', 'COUNT(payment.id) as count'])
      .groupBy('payment.status')
      .getRawMany();

    const byStatus: Record<string, number> = {};
    for (const ss of statusStats) {
      byStatus[ss.status] = parseInt(ss.count, 10);
    }

    // This month and last month totals
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthStats = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amountPaid) as total')
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('payment.paymentDate >= :start', { start: thisMonthStart })
      .getRawOne();

    const lastMonthStats = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amountPaid) as total')
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('payment.paymentDate >= :start', { start: lastMonthStart })
      .andWhere('payment.paymentDate <= :end', { end: lastMonthEnd })
      .getRawOne();

    // Recent payments
    const recentPayments = await this.paymentRepository.find({
      relations: ['purchaseOrder', 'purchaseOrder.vendor'],
      order: { createdAt: 'DESC' },
      take: 5,
    });

    return {
      totalPayments: parseInt(overallStats.totalPayments, 10) || 0,
      totalAmount: parseFloat(overallStats.totalAmount) || 0,
      averagePaymentAmount: parseFloat(overallStats.avgAmount) || 0,
      byMethod,
      byStatus,
      thisMonthTotal: parseFloat(thisMonthStats.total) || 0,
      lastMonthTotal: parseFloat(lastMonthStats.total) || 0,
      recentPayments,
    };
  }

  /**
   * Get payment trends (for analytics - BONUS feature)
   */
  async getPaymentTrends(months: number = 12): Promise<{
    monthly: Array<{ month: string; count: number; amount: number }>;
    weekly: Array<{ week: string; count: number; amount: number }>;
  }> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Monthly trends
    const monthlyData = await this.paymentRepository
      .createQueryBuilder('payment')
      .select([
        "DATE_FORMAT(payment.paymentDate, '%Y-%m') as month",
        'COUNT(payment.id) as count',
        'SUM(payment.amountPaid) as amount',
      ])
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('payment.paymentDate >= :startDate', { startDate })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    // Weekly trends (last 12 weeks)
    const weekStartDate = new Date();
    weekStartDate.setDate(weekStartDate.getDate() - 84); // 12 weeks

    const weeklyData = await this.paymentRepository
      .createQueryBuilder('payment')
      .select([
        "DATE_FORMAT(payment.paymentDate, '%Y-W%u') as week",
        'COUNT(payment.id) as count',
        'SUM(payment.amountPaid) as amount',
      ])
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('payment.paymentDate >= :startDate', { startDate: weekStartDate })
      .groupBy('week')
      .orderBy('week', 'ASC')
      .getRawMany();

    return {
      monthly: monthlyData.map(d => ({
        month: d.month,
        count: parseInt(d.count, 10),
        amount: parseFloat(d.amount) || 0,
      })),
      weekly: weeklyData.map(d => ({
        week: d.week,
        count: parseInt(d.count, 10),
        amount: parseFloat(d.amount) || 0,
      })),
    };
  }
}
