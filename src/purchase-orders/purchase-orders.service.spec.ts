import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { PurchaseOrderStatus, PaymentTerms, VendorStatus } from '../common/enums';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let poRepository: Repository<PurchaseOrder>;
  let vendorRepository: Repository<Vendor>;

  const mockVendor: Partial<Vendor> = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Vendor',
    email: 'test@vendor.com',
    paymentTerms: PaymentTerms.NET_30,
    status: VendorStatus.ACTIVE,
  };

  const mockPurchaseOrder: Partial<PurchaseOrder> = {
    id: '223e4567-e89b-12d3-a456-426614174001',
    poNumber: 'PO-20260114-001',
    vendor: mockVendor as Vendor,
    poDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    totalAmount: 10000,
    paidAmount: 0,
    outstandingAmount: 10000,
    status: PurchaseOrderStatus.PENDING,
    items: [],
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ ...entity, id: 'mock-id' })),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  const mockPoRepository = {
    create: jest.fn().mockImplementation((dto) => ({ ...dto, id: mockPurchaseOrder.id })),
    save: jest.fn().mockImplementation((po) => Promise.resolve({ ...mockPurchaseOrder, ...po })),
    findOne: jest.fn(),
    find: jest.fn(),
    softRemove: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
      getMany: jest.fn().mockResolvedValue([mockPurchaseOrder]),
      getOne: jest.fn().mockResolvedValue(null),
      getRawOne: jest.fn().mockResolvedValue({ total: 1 }),
      getRawMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    })),
  };

  const mockPoItemRepository = {
    create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'item-id' })),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockVendorRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        {
          provide: getRepositoryToken(PurchaseOrder),
          useValue: mockPoRepository,
        },
        {
          provide: getRepositoryToken(PurchaseOrderItem),
          useValue: mockPoItemRepository,
        },
        {
          provide: getRepositoryToken(Vendor),
          useValue: mockVendorRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
    poRepository = module.get<Repository<PurchaseOrder>>(getRepositoryToken(PurchaseOrder));
    vendorRepository = module.get<Repository<Vendor>>(getRepositoryToken(Vendor));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreatePurchaseOrderDto = {
      vendorId: mockVendor.id!,
      items: [
        {
          description: 'Test Item',
          quantity: 10,
          unitPrice: 1000,
          taxRate: 18,
        },
      ],
    };

    it('should create a purchase order successfully', async () => {
      mockVendorRepository.findOne.mockResolvedValueOnce(mockVendor);
      mockPoRepository.findOne.mockResolvedValueOnce({
        ...mockPurchaseOrder,
        items: [],
        payments: [],
      });

      const result = await service.create(createDto, 'user-id');

      expect(mockVendorRepository.findOne).toHaveBeenCalledWith({
        where: { id: createDto.vendorId },
      });
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if vendor not found', async () => {
      mockVendorRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.create(createDto, 'user-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if vendor is inactive', async () => {
      mockVendorRepository.findOne.mockResolvedValueOnce({
        ...mockVendor,
        status: VendorStatus.INACTIVE,
      });

      await expect(service.create(createDto, 'user-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a purchase order by id', async () => {
      mockPoRepository.findOne.mockResolvedValueOnce(mockPurchaseOrder);

      const result = await service.findOne(mockPurchaseOrder.id!);

      expect(result).toEqual(mockPurchaseOrder);
    });

    it('should throw NotFoundException if PO not found', async () => {
      mockPoRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validateStatusTransition', () => {
    it('should allow valid status transitions', async () => {
      const po = { ...mockPurchaseOrder, status: PurchaseOrderStatus.PENDING };
      mockPoRepository.findOne.mockResolvedValue(po);

      // PENDING -> APPROVED is valid
      await expect(
        service.update(po.id!, { status: PurchaseOrderStatus.APPROVED }, 'user-id'),
      ).resolves.toBeDefined();
    });

    it('should reject invalid status transitions', async () => {
      const po = { ...mockPurchaseOrder, status: PurchaseOrderStatus.PAID };
      mockPoRepository.findOne.mockResolvedValue(po);

      // PAID -> PENDING is invalid
      await expect(
        service.update(po.id!, { status: PurchaseOrderStatus.PENDING }, 'user-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel a purchase order', async () => {
      const po = {
        ...mockPurchaseOrder,
        status: PurchaseOrderStatus.PENDING,
        paidAmount: 0,
      };
      mockPoRepository.findOne.mockResolvedValue(po);

      const result = await service.cancel(po.id!, 'user-id');

      expect(mockPoRepository.save).toHaveBeenCalled();
    });

    it('should not allow cancelling a paid PO', async () => {
      const po = {
        ...mockPurchaseOrder,
        status: PurchaseOrderStatus.PAID,
      };
      mockPoRepository.findOne.mockResolvedValue(po);

      await expect(service.cancel(po.id!, 'user-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not allow cancelling a PO with payments', async () => {
      const po = {
        ...mockPurchaseOrder,
        status: PurchaseOrderStatus.PARTIALLY_PAID,
        paidAmount: 5000,
      };
      mockPoRepository.findOne.mockResolvedValue(po);

      await expect(service.cancel(po.id!, 'user-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
