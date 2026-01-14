import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Vendor } from '../vendors/entities/vendor.entity';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchase-orders/entities/purchase-order-item.entity';
import { Payment } from '../payments/entities/payment.entity';
import {
  VendorStatus,
  PaymentTerms,
  PurchaseOrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../common/enums';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Vendor)
    private readonly vendorRepository: Repository<Vendor>,
    @InjectRepository(PurchaseOrder)
    private readonly poRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly poItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    // Check if seeding is enabled
    if (process.env.SEED_DATA !== 'true') {
      this.logger.log('Seeding disabled. Set SEED_DATA=true to enable.');
      return;
    }

    // Check if data already exists
    const vendorCount = await this.vendorRepository.count();
    if (vendorCount > 0) {
      this.logger.log('Data already exists. Skipping seed.');
      return;
    }

    await this.seed();
  }

  async seed(): Promise<void> {
    this.logger.log('Starting database seeding...');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create vendors
      const vendors = await this.createVendors(queryRunner);
      this.logger.log(`Created ${vendors.length} vendors`);

      // Create purchase orders with items
      const purchaseOrders = await this.createPurchaseOrders(queryRunner, vendors);
      this.logger.log(`Created ${purchaseOrders.length} purchase orders`);

      // Create payments
      const payments = await this.createPayments(queryRunner, purchaseOrders);
      this.logger.log(`Created ${payments.length} payments`);

      await queryRunner.commitTransaction();
      this.logger.log('Database seeding completed successfully!');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Seeding failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async createVendors(queryRunner: any): Promise<Vendor[]> {
    const vendorData = [
      {
        name: 'TechPro Solutions Pvt Ltd',
        email: 'billing@techpro.in',
        contactPerson: 'Rajesh Kumar',
        phoneNumber: '+91 98765 43210',
        paymentTerms: PaymentTerms.NET_30,
        status: VendorStatus.ACTIVE,
        address: '123 Tech Park, Whitefield, Bangalore 560066',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        postalCode: '560066',
        gstNumber: '29AABCT1234H1Z5',
        panNumber: 'AABCT1234H',
        bankAccountName: 'TechPro Solutions Pvt Ltd',
        bankAccountNumber: '1234567890123456',
        bankName: 'HDFC Bank',
        bankBranch: 'Whitefield Branch',
        ifscCode: 'HDFC0001234',
        website: 'https://techpro.in',
        notes: 'Preferred vendor for IT equipment and software',
      },
      {
        name: 'Green Office Supplies',
        email: 'sales@greenoffice.com',
        contactPerson: 'Priya Sharma',
        phoneNumber: '+91 87654 32109',
        paymentTerms: PaymentTerms.NET_15,
        status: VendorStatus.ACTIVE,
        address: '456 Industrial Area, Andheri East, Mumbai 400069',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '400069',
        gstNumber: '27AABCG5678J1Z2',
        panNumber: 'AABCG5678J',
        bankAccountName: 'Green Office Supplies',
        bankAccountNumber: '9876543210987654',
        bankName: 'ICICI Bank',
        bankBranch: 'Andheri Branch',
        ifscCode: 'ICIC0005678',
        website: 'https://greenoffice.com',
        notes: 'Eco-friendly office supplies vendor',
      },
      {
        name: 'FastLogistics India',
        email: 'accounts@fastlogistics.in',
        contactPerson: 'Amit Patel',
        phoneNumber: '+91 76543 21098',
        paymentTerms: PaymentTerms.NET_45,
        status: VendorStatus.ACTIVE,
        address: '789 Logistics Hub, Gurgaon Sector 18, Haryana 122015',
        city: 'Gurgaon',
        state: 'Haryana',
        country: 'India',
        postalCode: '122015',
        gstNumber: '06AABCF9012K1Z8',
        panNumber: 'AABCF9012K',
        bankAccountName: 'FastLogistics India',
        bankAccountNumber: '5678901234567890',
        bankName: 'Axis Bank',
        bankBranch: 'Sector 18 Branch',
        ifscCode: 'UTIB0009012',
        notes: 'Courier and logistics services',
      },
      {
        name: 'Elite Catering Services',
        email: 'info@elitecatering.in',
        contactPerson: 'Sunita Reddy',
        phoneNumber: '+91 65432 10987',
        paymentTerms: PaymentTerms.IMMEDIATE,
        status: VendorStatus.ACTIVE,
        address: '321 Food Street, Jubilee Hills, Hyderabad 500033',
        city: 'Hyderabad',
        state: 'Telangana',
        country: 'India',
        postalCode: '500033',
        gstNumber: '36AABCE3456L1Z4',
        panNumber: 'AABCE3456L',
        bankAccountName: 'Elite Catering Services',
        bankAccountNumber: '3456789012345678',
        bankName: 'State Bank of India',
        bankBranch: 'Jubilee Hills Branch',
        ifscCode: 'SBIN0003456',
        notes: 'Corporate events and office catering',
      },
      {
        name: 'SecureIT Systems (Inactive)',
        email: 'contact@secureit.com',
        contactPerson: 'Vikram Singh',
        phoneNumber: '+91 54321 09876',
        paymentTerms: PaymentTerms.NET_60,
        status: VendorStatus.INACTIVE,
        address: '654 Cyber City, DLF Phase 2, Gurgaon 122002',
        city: 'Gurgaon',
        state: 'Haryana',
        country: 'India',
        postalCode: '122002',
        gstNumber: '06AABCS7890M1Z1',
        panNumber: 'AABCS7890M',
        bankAccountName: 'SecureIT Systems',
        bankAccountNumber: '7890123456789012',
        bankName: 'Kotak Mahindra Bank',
        bankBranch: 'DLF Branch',
        ifscCode: 'KKBK0007890',
        notes: 'Former security software vendor - contract ended',
      },
    ];

    const vendors: Vendor[] = [];
    for (const data of vendorData) {
      const vendor = this.vendorRepository.create(data);
      const saved = await queryRunner.manager.save(vendor);
      vendors.push(saved);
    }

    return vendors;
  }

  private async createPurchaseOrders(
    queryRunner: any,
    vendors: Vendor[],
  ): Promise<PurchaseOrder[]> {
    const purchaseOrders: PurchaseOrder[] = [];
    const today = new Date();

    // PO data for different scenarios
    const poConfigs = [
      // Vendor 0 (TechPro) - 4 POs
      {
        vendorIndex: 0,
        poNumber: 'PO-20260101-001',
        daysAgo: 45,
        status: PurchaseOrderStatus.PAID,
        items: [
          { description: 'Dell Laptop XPS 15', quantity: 5, unitPrice: 125000, taxRate: 18 },
          { description: 'Microsoft Office 365 License', quantity: 10, unitPrice: 8500, taxRate: 18 },
        ],
        paidPercent: 100,
      },
      {
        vendorIndex: 0,
        poNumber: 'PO-20260110-002',
        daysAgo: 35,
        status: PurchaseOrderStatus.PARTIALLY_PAID,
        items: [
          { description: 'HP Monitor 27"', quantity: 10, unitPrice: 25000, taxRate: 18 },
          { description: 'Logitech Wireless Keyboard', quantity: 15, unitPrice: 3500, taxRate: 18 },
        ],
        paidPercent: 50,
      },
      {
        vendorIndex: 0,
        poNumber: 'PO-20260120-003',
        daysAgo: 25,
        status: PurchaseOrderStatus.APPROVED,
        items: [
          { description: 'Server Rack Equipment', quantity: 1, unitPrice: 450000, taxRate: 18 },
        ],
        paidPercent: 0,
      },
      {
        vendorIndex: 0,
        poNumber: 'PO-20260125-004',
        daysAgo: 5,
        status: PurchaseOrderStatus.PENDING,
        items: [
          { description: 'Network Cables Cat6', quantity: 100, unitPrice: 500, taxRate: 18 },
          { description: 'USB-C Docking Stations', quantity: 10, unitPrice: 12000, taxRate: 18 },
        ],
        paidPercent: 0,
      },
      // Vendor 1 (Green Office) - 3 POs
      {
        vendorIndex: 1,
        poNumber: 'PO-20260105-005',
        daysAgo: 40,
        status: PurchaseOrderStatus.PAID,
        items: [
          { description: 'A4 Paper Reams (500 sheets)', quantity: 200, unitPrice: 350, taxRate: 12 },
          { description: 'Recycled Notebooks', quantity: 100, unitPrice: 150, taxRate: 12 },
        ],
        paidPercent: 100,
      },
      {
        vendorIndex: 1,
        poNumber: 'PO-20260115-006',
        daysAgo: 30,
        status: PurchaseOrderStatus.OVERDUE,
        items: [
          { description: 'Ergonomic Office Chairs', quantity: 20, unitPrice: 15000, taxRate: 18 },
          { description: 'Standing Desk Converters', quantity: 10, unitPrice: 12000, taxRate: 18 },
        ],
        paidPercent: 0,
      },
      {
        vendorIndex: 1,
        poNumber: 'PO-20260122-007',
        daysAgo: 8,
        status: PurchaseOrderStatus.APPROVED,
        items: [
          { description: 'Whiteboard Markers (Box)', quantity: 50, unitPrice: 250, taxRate: 12 },
          { description: 'Sticky Notes Variety Pack', quantity: 100, unitPrice: 120, taxRate: 12 },
        ],
        paidPercent: 0,
      },
      // Vendor 2 (FastLogistics) - 3 POs
      {
        vendorIndex: 2,
        poNumber: 'PO-20260108-008',
        daysAgo: 50,
        status: PurchaseOrderStatus.PAID,
        items: [
          { description: 'Monthly Courier Service - January', quantity: 1, unitPrice: 75000, taxRate: 18 },
        ],
        paidPercent: 100,
      },
      {
        vendorIndex: 2,
        poNumber: 'PO-20260118-009',
        daysAgo: 20,
        status: PurchaseOrderStatus.PARTIALLY_PAID,
        items: [
          { description: 'Express Delivery Package', quantity: 50, unitPrice: 500, taxRate: 18 },
          { description: 'Standard Delivery Package', quantity: 100, unitPrice: 250, taxRate: 18 },
        ],
        paidPercent: 30,
      },
      {
        vendorIndex: 2,
        poNumber: 'PO-20260128-010',
        daysAgo: 2,
        status: PurchaseOrderStatus.PENDING,
        items: [
          { description: 'Monthly Courier Service - February', quantity: 1, unitPrice: 80000, taxRate: 18 },
        ],
        paidPercent: 0,
      },
      // Vendor 3 (Elite Catering) - 3 POs
      {
        vendorIndex: 3,
        poNumber: 'PO-20260112-011',
        daysAgo: 35,
        status: PurchaseOrderStatus.PAID,
        items: [
          { description: 'Annual Day Event Catering', quantity: 1, unitPrice: 250000, taxRate: 5 },
        ],
        paidPercent: 100,
      },
      {
        vendorIndex: 3,
        poNumber: 'PO-20260120-012',
        daysAgo: 18,
        status: PurchaseOrderStatus.OVERDUE,
        items: [
          { description: 'Weekly Lunch Service - Week 3', quantity: 500, unitPrice: 200, taxRate: 5 },
        ],
        paidPercent: 0,
      },
      {
        vendorIndex: 3,
        poNumber: 'PO-20260126-013',
        daysAgo: 4,
        status: PurchaseOrderStatus.APPROVED,
        items: [
          { description: 'Team Building Event Catering', quantity: 1, unitPrice: 150000, taxRate: 5 },
        ],
        paidPercent: 0,
      },
      // Cancelled PO
      {
        vendorIndex: 0,
        poNumber: 'PO-20260102-014',
        daysAgo: 60,
        status: PurchaseOrderStatus.CANCELLED,
        items: [
          { description: 'Cancelled Order - MacBook Pro', quantity: 2, unitPrice: 200000, taxRate: 18 },
        ],
        paidPercent: 0,
      },
      // Another overdue for aging report variety
      {
        vendorIndex: 1,
        poNumber: 'PO-20251201-015',
        daysAgo: 75,
        status: PurchaseOrderStatus.OVERDUE,
        items: [
          { description: 'Old Office Renovation Materials', quantity: 1, unitPrice: 350000, taxRate: 18 },
        ],
        paidPercent: 0,
      },
    ];

    for (const config of poConfigs) {
      const vendor = vendors[config.vendorIndex];
      const poDate = new Date(today);
      poDate.setDate(poDate.getDate() - config.daysAgo);

      // Calculate due date based on vendor payment terms
      const dueDate = new Date(poDate);
      const daysMap: Record<PaymentTerms, number> = {
        [PaymentTerms.NET_15]: 15,
        [PaymentTerms.NET_30]: 30,
        [PaymentTerms.NET_45]: 45,
        [PaymentTerms.NET_60]: 60,
        [PaymentTerms.IMMEDIATE]: 0,
        [PaymentTerms.ADVANCE]: -7,
      };
      dueDate.setDate(dueDate.getDate() + daysMap[vendor.paymentTerms]);

      // Calculate totals
      let subtotal = 0;
      let totalTax = 0;

      for (const item of config.items) {
        const itemSubtotal = item.quantity * item.unitPrice;
        const itemTax = itemSubtotal * ((item.taxRate || 0) / 100);
        subtotal += itemSubtotal;
        totalTax += itemTax;
      }

      const totalAmount = subtotal + totalTax;
      const paidAmount = (totalAmount * config.paidPercent) / 100;
      const outstandingAmount = totalAmount - paidAmount;

      const purchaseOrder = this.poRepository.create({
        poNumber: config.poNumber,
        vendor,
        poDate,
        dueDate,
        subtotal: Number(subtotal.toFixed(2)),
        taxAmount: Number(totalTax.toFixed(2)),
        discountAmount: 0,
        totalAmount: Number(totalAmount.toFixed(2)),
        paidAmount: Number(paidAmount.toFixed(2)),
        outstandingAmount: Number(outstandingAmount.toFixed(2)),
        status: config.status,
      });

      const savedPO = await queryRunner.manager.save(purchaseOrder);

      // Create items
      for (const itemData of config.items) {
        const itemSubtotal = itemData.quantity * itemData.unitPrice;
        const itemTax = itemSubtotal * ((itemData.taxRate || 0) / 100);
        const itemTotal = itemSubtotal + itemTax;

        const item = this.poItemRepository.create({
          purchaseOrder: savedPO,
          description: itemData.description,
          quantity: itemData.quantity,
          unitPrice: itemData.unitPrice,
          taxRate: itemData.taxRate || 0,
          discountPercent: 0,
          totalPrice: Number(itemTotal.toFixed(2)),
          unit: 'each',
        });

        await queryRunner.manager.save(item);
      }

      purchaseOrders.push(savedPO);
    }

    return purchaseOrders;
  }

  private async createPayments(
    queryRunner: any,
    purchaseOrders: PurchaseOrder[],
  ): Promise<Payment[]> {
    const payments: Payment[] = [];
    const today = new Date();

    // Create payments for POs that have been paid (fully or partially)
    const paymentConfigs = [
      // Full payments for PAID POs
      { poNumber: 'PO-20260101-001', paymentRef: 'PAY-20260115-001', daysAgo: 30, percent: 100, method: PaymentMethod.BANK_TRANSFER },
      { poNumber: 'PO-20260105-005', paymentRef: 'PAY-20260112-002', daysAgo: 35, percent: 100, method: PaymentMethod.UPI },
      { poNumber: 'PO-20260108-008', paymentRef: 'PAY-20260120-003', daysAgo: 25, percent: 100, method: PaymentMethod.BANK_TRANSFER },
      { poNumber: 'PO-20260112-011', paymentRef: 'PAY-20260112-004', daysAgo: 35, percent: 100, method: PaymentMethod.CHEQUE },
      
      // Partial payments
      { poNumber: 'PO-20260110-002', paymentRef: 'PAY-20260125-005', daysAgo: 15, percent: 50, method: PaymentMethod.BANK_TRANSFER },
      { poNumber: 'PO-20260118-009', paymentRef: 'PAY-20260128-006', daysAgo: 10, percent: 30, method: PaymentMethod.UPI },
      
      // Voided payment example
      { poNumber: 'PO-20260101-001', paymentRef: 'PAY-20260110-007', daysAgo: 40, percent: 20, method: PaymentMethod.BANK_TRANSFER, voided: true, voidReason: 'Duplicate payment - already paid via another transaction' },
    ];

    for (const config of paymentConfigs) {
      const purchaseOrder = purchaseOrders.find(po => po.poNumber === config.poNumber);
      if (!purchaseOrder) continue;

      // Reload PO with vendor to get correct total
      const po = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { id: purchaseOrder.id },
        relations: ['vendor'],
      });

      const paymentDate = new Date(today);
      paymentDate.setDate(paymentDate.getDate() - config.daysAgo);

      const amountPaid = (Number(po.totalAmount) * config.percent) / 100;

      const payment = this.paymentRepository.create({
        paymentReference: config.paymentRef,
        purchaseOrder: po,
        paymentDate,
        amountPaid: Number(amountPaid.toFixed(2)),
        paymentMethod: config.method,
        status: config.voided ? PaymentStatus.VOIDED : PaymentStatus.COMPLETED,
        transactionReference: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        bankName: config.method === PaymentMethod.BANK_TRANSFER ? 'HDFC Bank' : undefined,
        chequeNumber: config.method === PaymentMethod.CHEQUE ? `CHQ-${Math.random().toString().substr(2, 6)}` : undefined,
        voidedAt: config.voided ? new Date() : undefined,
        voidReason: config.voidReason,
      });

      const savedPayment = await queryRunner.manager.save(payment);
      payments.push(savedPayment);
    }

    return payments;
  }

  /**
   * Clear all seed data (for testing)
   */
  async clear(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
      await queryRunner.query('TRUNCATE TABLE payments');
      await queryRunner.query('TRUNCATE TABLE purchase_order_items');
      await queryRunner.query('TRUNCATE TABLE purchase_orders');
      await queryRunner.query('TRUNCATE TABLE vendors');
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');

      await queryRunner.commitTransaction();
      this.logger.log('All seed data cleared');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
