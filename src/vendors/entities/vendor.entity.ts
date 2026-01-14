import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { VendorStatus, PaymentTerms } from '../../common/enums';
import { PurchaseOrder } from '../../purchase-orders/entities/purchase-order.entity';

@Entity('vendors')
@Index(['status'])
export class Vendor extends BaseEntity {
  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ name: 'contact_person', type: 'varchar', length: 255, nullable: true })
  contactPerson: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 20, nullable: true })
  phoneNumber: string;

  @Column({
    name: 'payment_terms',
    type: 'enum',
    enum: PaymentTerms,
    default: PaymentTerms.NET_30,
  })
  paymentTerms: PaymentTerms;

  @Column({
    type: 'enum',
    enum: VendorStatus,
    default: VendorStatus.ACTIVE,
  })
  status: VendorStatus;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ name: 'gst_number', type: 'varchar', length: 20, nullable: true })
  gstNumber: string;

  @Column({ name: 'pan_number', type: 'varchar', length: 10, nullable: true })
  panNumber: string;

  @Column({ name: 'bank_account_number', type: 'varchar', length: 20, nullable: true })
  bankAccountNumber: string;

  @Column({ name: 'bank_ifsc_code', type: 'varchar', length: 15, nullable: true })
  bankIfscCode: string;

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName: string;

  @OneToMany(() => PurchaseOrder, (purchaseOrder) => purchaseOrder.vendor)
  purchaseOrders: PurchaseOrder[];
}
