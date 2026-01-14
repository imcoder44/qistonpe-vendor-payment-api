import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { PurchaseOrderStatus } from '../../common/enums';
import { Vendor } from '../../vendors/entities/vendor.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { Payment } from '../../payments/entities/payment.entity';

@Entity('purchase_orders')
@Index(['vendorId'])
@Index(['status'])
@Index(['poDate'])
@Index(['dueDate'])
export class PurchaseOrder extends BaseEntity {
  @Column({ name: 'po_number', type: 'varchar', length: 50, unique: true })
  poNumber: string;

  @Column({ name: 'vendor_id', type: 'uuid' })
  vendorId: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.purchaseOrders, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Column({ name: 'po_date', type: 'date' })
  poDate: Date;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  totalAmount: number;

  @Column({
    name: 'paid_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  paidAmount: number;

  @Column({
    name: 'outstanding_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  outstandingAmount: number;

  @Column({
    name: 'subtotal',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  subtotal: number;

  @Column({
    type: 'enum',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.PENDING,
  })
  status: PurchaseOrderStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'reference_number', type: 'varchar', length: 100, nullable: true })
  referenceNumber: string;

  @Column({ name: 'shipping_address', type: 'text', nullable: true })
  shippingAddress: string;

  @Column({ name: 'billing_address', type: 'text', nullable: true })
  billingAddress: string;

  @Column({
    name: 'tax_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  taxAmount: number;

  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  discountAmount: number;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, {
    cascade: true,
    eager: true,
  })
  items: PurchaseOrderItem[];

  @OneToMany(() => Payment, (payment) => payment.purchaseOrder)
  payments: Payment[];
}
