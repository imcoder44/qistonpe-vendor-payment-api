export enum VendorStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
}

export enum PaymentTerms {
  NET_15 = 15,
  NET_30 = 30,
  NET_45 = 45,
  NET_60 = 60,
  IMMEDIATE = 0,
  ADVANCE = -7,
}

export enum PurchaseOrderStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  PARTIALLY_PAID = 'Partially Paid',
  PAID = 'Paid',
  OVERDUE = 'Overdue',
  CANCELLED = 'Cancelled',
}

export enum PaymentMethod {
  BANK_TRANSFER = 'Bank Transfer',
  CASH = 'Cash',
  CHEQUE = 'Cheque',
  UPI = 'UPI',
  NEFT = 'NEFT',
  RTGS = 'RTGS',
}

export enum PaymentStatus {
  COMPLETED = 'Completed',
  VOIDED = 'Voided',
}
