import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { PaymentMethod, PaymentStatus } from '../../common/enums';
import { PurchaseOrder } from '../../purchase-orders/entities/purchase-order.entity';

@Entity('payments')
@Index(['purchaseOrderId'])
@Index(['paymentDate'])
@Index(['status'])
export class Payment extends BaseEntity {
  @Column({ name: 'payment_reference', type: 'varchar', length: 50, unique: true })
  paymentReference: string;

  @Column({ name: 'purchase_order_id', type: 'uuid' })
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder, (po) => po.payments, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @Column({ name: 'payment_date', type: 'date' })
  paymentDate: Date;

  @Column({
    name: 'amount_paid',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  amountPaid: number;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
  })
  paymentMethod: PaymentMethod;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.COMPLETED,
  })
  status: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'transaction_reference', type: 'varchar', length: 100, nullable: true })
  transactionReference: string;

  @Column({ name: 'transaction_id', type: 'varchar', length: 100, nullable: true })
  transactionId: string;

  @Column({ name: 'cheque_number', type: 'varchar', length: 50, nullable: true })
  chequeNumber: string;

  @Column({ name: 'cheque_date', type: 'date', nullable: true })
  chequeDate: Date;

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName: string;

  @Column({ name: 'voided_at', type: 'timestamp', nullable: true })
  voidedAt: Date;

  @Column({ name: 'void_reason', type: 'text', nullable: true })
  voidReason: string;

  @Column({ name: 'voided_by', type: 'varchar', length: 255, nullable: true })
  voidedBy: string;
}
