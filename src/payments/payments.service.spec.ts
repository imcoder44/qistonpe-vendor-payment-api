import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentMethod, PaymentStatus, PurchaseOrderStatus, PaymentTerms, VendorStatus } from '../common/enums';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepository: Repository<Payment>;
  let poService: PurchaseOrdersService;

  const mockVendor = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Vendor',
    paymentTerms: PaymentTerms.NET_30,
    status: VendorStatus.ACTIVE,
  };

  const mockPurchaseOrder: Partial<PurchaseOrder> = {
    id: '223e4567-e89b-12d3-a456-426614174001',
    poNumber: 'PO-20260114-001',
    vendor: mockVendor as any,
    totalAmount: 10000,
    paidAmount: 0,
    outstandingAmount: 10000,
    status: PurchaseOrderStatus.APPROVED,
  };

  const mockPayment: Partial<Payment> = {
    id: '323e4567-e89b-12d3-a456-426614174002',
    paymentReference: 'PAY-20260114-001',
    purchaseOrder: mockPurchaseOrder as PurchaseOrder,
    amountPaid: 5000,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    status: PaymentStatus.COMPLETED,
    paymentDate: new Date(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  const mockPaymentRepository = {
    create: jest.fn().mockImplementation((dto) => ({ ...dto, id: mockPayment.id })),
    save: jest.fn().mockImplementation((payment) => Promise.resolve({ ...mockPayment, ...payment })),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
      getMany: jest.fn().mockResolvedValue([mockPayment]),
      getOne: jest.fn().mockResolvedValue(null),
      select: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: 0 }),
      getRawMany: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockPoRepository = {
    findOne: jest.fn(),
  };

  const mockPoService = {
    findOne: jest.fn(),
    updatePaymentAmounts: jest.fn(),
    reversePaymentAmount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        {
          provide: getRepositoryToken(PurchaseOrder),
          useValue: mockPoRepository,
        },
        {
          provide: PurchaseOrdersService,
          useValue: mockPoService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymentRepository = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    poService = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreatePaymentDto = {
      purchaseOrderId: mockPurchaseOrder.id!,
      amountPaid: 5000,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
    };

    it('should record a payment successfully', async () => {
      mockPoService.findOne.mockResolvedValueOnce(mockPurchaseOrder);
      mockPaymentRepository.findOne.mockResolvedValueOnce({
        ...mockPayment,
        purchaseOrder: mockPurchaseOrder,
      });

      const result = await service.create(createDto, 'user-id');

      expect(mockPoService.findOne).toHaveBeenCalledWith(createDto.purchaseOrderId);
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockPoService.updatePaymentAmounts).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException for cancelled PO', async () => {
      mockPoService.findOne.mockResolvedValueOnce({
        ...mockPurchaseOrder,
        status: PurchaseOrderStatus.CANCELLED,
      });

      await expect(service.create(createDto, 'user-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for already paid PO', async () => {
      mockPoService.findOne.mockResolvedValueOnce({
        ...mockPurchaseOrder,
        status: PurchaseOrderStatus.PAID,
      });

      await expect(service.create(createDto, 'user-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for pending PO', async () => {
      mockPoService.findOne.mockResolvedValueOnce({
        ...mockPurchaseOrder,
        status: PurchaseOrderStatus.PENDING,
      });

      await expect(service.create(createDto, 'user-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if payment exceeds outstanding', async () => {
      mockPoService.findOne.mockResolvedValueOnce({
        ...mockPurchaseOrder,
        outstandingAmount: 3000,
      });

      await expect(service.create(createDto, 'user-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a payment by id', async () => {
      mockPaymentRepository.findOne.mockResolvedValueOnce(mockPayment);

      const result = await service.findOne(mockPayment.id!);

      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException if payment not found', async () => {
      mockPaymentRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('void', () => {
    const voidDto = { voidReason: 'Duplicate payment' };

    it('should void a payment successfully', async () => {
      mockPaymentRepository.findOne
        .mockResolvedValueOnce(mockPayment)
        .mockResolvedValueOnce({
          ...mockPayment,
          status: PaymentStatus.VOIDED,
        });

      const result = await service.void(mockPayment.id!, voidDto, 'user-id');

      expect(mockPoService.reversePaymentAmount).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException if payment already voided', async () => {
      mockPaymentRepository.findOne.mockResolvedValueOnce({
        ...mockPayment,
        status: PaymentStatus.VOIDED,
      });

      await expect(
        service.void(mockPayment.id!, voidDto, 'user-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
