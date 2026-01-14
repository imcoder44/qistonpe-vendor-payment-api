import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThanOrEqual, Between, In } from 'typeorm';
import { Vendor } from '../vendors/entities/vendor.entity';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { Payment } from '../payments/entities/payment.entity';
import { PurchaseOrderStatus, PaymentStatus, VendorStatus, PaymentTerms } from '../common/enums';

export interface VendorOutstandingReport {
  vendorId: string;
  vendorName: string;
  vendorStatus: VendorStatus;
  paymentTerms: PaymentTerms | string;
  totalPurchaseOrders: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  overdueAmount: number;
  overdueCount: number;
}

export interface AgingBucket {
  label: string;
  minDays: number;
  maxDays: number | null;
  count: number;
  amount: number;
  purchaseOrders: Array<{
    id: string;
    poNumber: string;
    vendorName: string;
    dueDate: Date;
    daysOverdue: number;
    outstandingAmount: number;
  }>;
}

export interface PaymentAgingReport {
  summary: {
    totalOverdue: number;
    totalOverdueAmount: number;
    averageDaysOverdue: number;
  };
  buckets: AgingBucket[];
  byVendor: Array<{
    vendorId: string;
    vendorName: string;
    overdueCount: number;
    overdueAmount: number;
  }>;
}

export interface DashboardSummary {
  vendors: {
    total: number;
    active: number;
    inactive: number;
  };
  purchaseOrders: {
    total: number;
    pending: number;
    approved: number;
    partiallyPaid: number;
    paid: number;
    overdue: number;
    cancelled: number;
  };
  payments: {
    total: number;
    completed: number;
    voided: number;
    totalAmount: number;
    thisMonth: number;
    lastMonth: number;
  };
  outstanding: {
    totalAmount: number;
    overdueAmount: number;
    upcomingDue: number; // Due in next 7 days
  };
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Vendor)
    private readonly vendorRepository: Repository<Vendor>,
    @InjectRepository(PurchaseOrder)
    private readonly poRepository: Repository<PurchaseOrder>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  /**
   * Get outstanding amounts per vendor
   */
  async getVendorOutstanding(): Promise<VendorOutstandingReport[]> {
    const vendors = await this.vendorRepository
      .createQueryBuilder('vendor')
      .leftJoinAndSelect('vendor.purchaseOrders', 'po', 'po.deletedAt IS NULL')
      .orderBy('vendor.name', 'ASC')
      .getMany();

    const today = new Date();
    const reports: VendorOutstandingReport[] = [];

    for (const vendor of vendors) {
      const purchaseOrders = vendor.purchaseOrders || [];
      
      // Filter out cancelled POs
      const activePOs = purchaseOrders.filter(
        po => po.status !== PurchaseOrderStatus.CANCELLED,
      );

      const totalAmount = activePOs.reduce((sum, po) => sum + Number(po.totalAmount), 0);
      const paidAmount = activePOs.reduce((sum, po) => sum + Number(po.paidAmount), 0);
      const outstandingAmount = activePOs.reduce((sum, po) => sum + Number(po.outstandingAmount), 0);

      // Calculate overdue
      const overduePOs = activePOs.filter(
        po =>
          po.dueDate < today &&
          Number(po.outstandingAmount) > 0 &&
          po.status !== PurchaseOrderStatus.PAID,
      );
      const overdueAmount = overduePOs.reduce((sum, po) => sum + Number(po.outstandingAmount), 0);

      reports.push({
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorStatus: vendor.status,
        paymentTerms: vendor.paymentTerms,
        totalPurchaseOrders: activePOs.length,
        totalAmount: Number(totalAmount.toFixed(2)),
        paidAmount: Number(paidAmount.toFixed(2)),
        outstandingAmount: Number(outstandingAmount.toFixed(2)),
        overdueAmount: Number(overdueAmount.toFixed(2)),
        overdueCount: overduePOs.length,
      });
    }

    // Sort by outstanding amount descending
    reports.sort((a, b) => b.outstandingAmount - a.outstandingAmount);

    return reports;
  }

  /**
   * Get payment aging report with buckets
   */
  async getPaymentAging(): Promise<PaymentAgingReport> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all overdue POs
    const overduePOs = await this.poRepository
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.vendor', 'vendor')
      .where('po.dueDate < :today', { today })
      .andWhere('po.outstandingAmount > 0')
      .andWhere('po.status NOT IN (:...excluded)', {
        excluded: [PurchaseOrderStatus.PAID, PurchaseOrderStatus.CANCELLED],
      })
      .orderBy('po.dueDate', 'ASC')
      .getMany();

    // Define aging buckets
    const bucketDefinitions = [
      { label: '1-30 days', minDays: 1, maxDays: 30 },
      { label: '31-60 days', minDays: 31, maxDays: 60 },
      { label: '61-90 days', minDays: 61, maxDays: 90 },
      { label: '90+ days', minDays: 91, maxDays: null },
    ];

    const buckets: AgingBucket[] = bucketDefinitions.map(def => ({
      ...def,
      count: 0,
      amount: 0,
      purchaseOrders: [],
    }));

    let totalDaysOverdue = 0;
    const vendorOverdue: Map<string, { vendorId: string; vendorName: string; count: number; amount: number }> = new Map();

    for (const po of overduePOs) {
      const daysOverdue = Math.floor(
        (today.getTime() - new Date(po.dueDate).getTime()) / (1000 * 60 * 60 * 24),
      );
      totalDaysOverdue += daysOverdue;

      // Find appropriate bucket
      for (const bucket of buckets) {
        if (
          daysOverdue >= bucket.minDays &&
          (bucket.maxDays === null || daysOverdue <= bucket.maxDays)
        ) {
          bucket.count++;
          bucket.amount += Number(po.outstandingAmount);
          bucket.purchaseOrders.push({
            id: po.id,
            poNumber: po.poNumber,
            vendorName: po.vendor?.name || 'Unknown',
            dueDate: po.dueDate,
            daysOverdue,
            outstandingAmount: Number(po.outstandingAmount),
          });
          break;
        }
      }

      // Aggregate by vendor
      const vendorId = po.vendor?.id || 'unknown';
      const vendorName = po.vendor?.name || 'Unknown';
      if (!vendorOverdue.has(vendorId)) {
        vendorOverdue.set(vendorId, { vendorId, vendorName, count: 0, amount: 0 });
      }
      const vendorData = vendorOverdue.get(vendorId)!;
      vendorData.count++;
      vendorData.amount += Number(po.outstandingAmount);
    }

    // Format bucket amounts
    for (const bucket of buckets) {
      bucket.amount = Number(bucket.amount.toFixed(2));
    }

    const totalOverdueAmount = overduePOs.reduce(
      (sum, po) => sum + Number(po.outstandingAmount),
      0,
    );

    return {
      summary: {
        totalOverdue: overduePOs.length,
        totalOverdueAmount: Number(totalOverdueAmount.toFixed(2)),
        averageDaysOverdue:
          overduePOs.length > 0
            ? Math.round(totalDaysOverdue / overduePOs.length)
            : 0,
      },
      buckets,
      byVendor: Array.from(vendorOverdue.values())
        .sort((a, b) => b.amount - a.amount)
        .map(v => ({
          vendorId: v.vendorId,
          vendorName: v.vendorName,
          overdueCount: v.count,
          overdueAmount: Number(v.amount.toFixed(2)),
        })),
    };
  }

  /**
   * Get dashboard summary (BONUS feature)
   */
  async getDashboardSummary(): Promise<DashboardSummary> {
    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Vendor stats
    const vendorStats = await this.vendorRepository
      .createQueryBuilder('vendor')
      .select(['vendor.status', 'COUNT(vendor.id) as count'])
      .groupBy('vendor.status')
      .getRawMany();

    const vendorCounts = { total: 0, active: 0, inactive: 0 };
    for (const vs of vendorStats) {
      const count = parseInt(vs.count, 10);
      vendorCounts.total += count;
      if (vs.vendor_status === VendorStatus.ACTIVE) {
        vendorCounts.active = count;
      } else {
        vendorCounts.inactive += count;
      }
    }

    // PO stats
    const poStats = await this.poRepository
      .createQueryBuilder('po')
      .select(['po.status', 'COUNT(po.id) as count'])
      .groupBy('po.status')
      .getRawMany();

    const poCounts: any = {
      total: 0,
      pending: 0,
      approved: 0,
      partiallyPaid: 0,
      paid: 0,
      overdue: 0,
      cancelled: 0,
    };

    for (const ps of poStats) {
      const count = parseInt(ps.count, 10);
      poCounts.total += count;
      switch (ps.po_status) {
        case PurchaseOrderStatus.PENDING:
          poCounts.pending = count;
          break;
        case PurchaseOrderStatus.APPROVED:
          poCounts.approved = count;
          break;
        case PurchaseOrderStatus.PARTIALLY_PAID:
          poCounts.partiallyPaid = count;
          break;
        case PurchaseOrderStatus.PAID:
          poCounts.paid = count;
          break;
        case PurchaseOrderStatus.OVERDUE:
          poCounts.overdue = count;
          break;
        case PurchaseOrderStatus.CANCELLED:
          poCounts.cancelled = count;
          break;
      }
    }

    // Payment stats
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    const paymentStats = await this.paymentRepository
      .createQueryBuilder('payment')
      .select([
        'payment.status as status',
        'COUNT(payment.id) as count',
        'SUM(payment.amountPaid) as amount',
      ])
      .groupBy('payment.status')
      .getRawMany();

    const paymentCounts = { total: 0, completed: 0, voided: 0, totalAmount: 0 };
    for (const ps of paymentStats) {
      const count = parseInt(ps.count, 10);
      paymentCounts.total += count;
      if (ps.status === PaymentStatus.COMPLETED) {
        paymentCounts.completed = count;
        paymentCounts.totalAmount = parseFloat(ps.amount) || 0;
      } else if (ps.status === PaymentStatus.VOIDED) {
        paymentCounts.voided = count;
      }
    }

    // This month payments
    const thisMonthPayments = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amountPaid) as total')
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('payment.paymentDate >= :start', { start: thisMonthStart })
      .getRawOne();

    // Last month payments
    const lastMonthPayments = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amountPaid) as total')
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('payment.paymentDate >= :start', { start: lastMonthStart })
      .andWhere('payment.paymentDate <= :end', { end: lastMonthEnd })
      .getRawOne();

    // Outstanding stats
    const outstandingStats = await this.poRepository
      .createQueryBuilder('po')
      .select('SUM(po.outstandingAmount) as total')
      .where('po.status NOT IN (:...excluded)', {
        excluded: [PurchaseOrderStatus.PAID, PurchaseOrderStatus.CANCELLED],
      })
      .getRawOne();

    const overdueStats = await this.poRepository
      .createQueryBuilder('po')
      .select('SUM(po.outstandingAmount) as total')
      .where('po.dueDate < :today', { today })
      .andWhere('po.outstandingAmount > 0')
      .andWhere('po.status NOT IN (:...excluded)', {
        excluded: [PurchaseOrderStatus.PAID, PurchaseOrderStatus.CANCELLED],
      })
      .getRawOne();

    const upcomingDueStats = await this.poRepository
      .createQueryBuilder('po')
      .select('SUM(po.outstandingAmount) as total')
      .where('po.dueDate >= :today', { today })
      .andWhere('po.dueDate <= :sevenDays', { sevenDays: sevenDaysFromNow })
      .andWhere('po.outstandingAmount > 0')
      .andWhere('po.status NOT IN (:...excluded)', {
        excluded: [PurchaseOrderStatus.PAID, PurchaseOrderStatus.CANCELLED],
      })
      .getRawOne();

    return {
      vendors: vendorCounts,
      purchaseOrders: poCounts,
      payments: {
        total: paymentCounts.total,
        completed: paymentCounts.completed,
        voided: paymentCounts.voided,
        totalAmount: paymentCounts.totalAmount,
        thisMonth: parseFloat(thisMonthPayments?.total) || 0,
        lastMonth: parseFloat(lastMonthPayments?.total) || 0,
      },
      outstanding: {
        totalAmount: parseFloat(outstandingStats?.total) || 0,
        overdueAmount: parseFloat(overdueStats?.total) || 0,
        upcomingDue: parseFloat(upcomingDueStats?.total) || 0,
      },
    };
  }

  /**
   * Get cash flow forecast (BONUS feature)
   */
  async getCashFlowForecast(weeks: number = 4): Promise<{
    upcoming: Array<{
      weekStart: Date;
      weekEnd: Date;
      label: string;
      count: number;
      amount: number;
      purchaseOrders: Array<{
        id: string;
        poNumber: string;
        vendorName: string;
        dueDate: Date;
        outstandingAmount: number;
      }>;
    }>;
    total: {
      count: number;
      amount: number;
    };
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weeklyBuckets: Array<{
      weekStart: Date;
      weekEnd: Date;
      label: string;
      count: number;
      amount: number;
      purchaseOrders: any[];
    }> = [];

    // Create weekly buckets
    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + i * 7);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      weeklyBuckets.push({
        weekStart,
        weekEnd,
        label: `Week ${i + 1}`,
        count: 0,
        amount: 0,
        purchaseOrders: [],
      });
    }

    // Get POs with outstanding amounts and future due dates
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + weeks * 7);

    const upcomingPOs = await this.poRepository
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.vendor', 'vendor')
      .where('po.dueDate >= :today', { today })
      .andWhere('po.dueDate <= :endDate', { endDate })
      .andWhere('po.outstandingAmount > 0')
      .andWhere('po.status NOT IN (:...excluded)', {
        excluded: [PurchaseOrderStatus.PAID, PurchaseOrderStatus.CANCELLED],
      })
      .orderBy('po.dueDate', 'ASC')
      .getMany();

    // Assign POs to weekly buckets
    for (const po of upcomingPOs) {
      const poDate = new Date(po.dueDate);
      
      for (const bucket of weeklyBuckets) {
        if (poDate >= bucket.weekStart && poDate <= bucket.weekEnd) {
          bucket.count++;
          bucket.amount += Number(po.outstandingAmount);
          bucket.purchaseOrders.push({
            id: po.id,
            poNumber: po.poNumber,
            vendorName: po.vendor?.name || 'Unknown',
            dueDate: po.dueDate,
            outstandingAmount: Number(po.outstandingAmount),
          });
          break;
        }
      }
    }

    // Round amounts
    for (const bucket of weeklyBuckets) {
      bucket.amount = Number(bucket.amount.toFixed(2));
    }

    const totalCount = weeklyBuckets.reduce((sum, b) => sum + b.count, 0);
    const totalAmount = weeklyBuckets.reduce((sum, b) => sum + b.amount, 0);

    return {
      upcoming: weeklyBuckets,
      total: {
        count: totalCount,
        amount: Number(totalAmount.toFixed(2)),
      },
    };
  }

  /**
   * Get top vendors by outstanding (BONUS feature)
   */
  async getTopVendorsByOutstanding(limit: number = 10): Promise<VendorOutstandingReport[]> {
    const report = await this.getVendorOutstanding();
    return report.slice(0, limit);
  }
}
