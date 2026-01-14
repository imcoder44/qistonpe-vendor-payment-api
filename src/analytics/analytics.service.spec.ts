import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Vendor } from '../vendors/entities/vendor.entity';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  // Create comprehensive mock query builder
  const createMockQueryBuilder = () => ({
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
    addGroupBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
    getCount: jest.fn().mockResolvedValue(0),
    getRawOne: jest.fn().mockResolvedValue({ count: 0, total: 0 }),
    getRawMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  });

  const mockVendorRepository = {
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
  };

  const mockPoRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
  };

  const mockPaymentRepository = {
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(PurchaseOrder),
          useValue: mockPoRepository,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        {
          provide: getRepositoryToken(Vendor),
          useValue: mockVendorRepository,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardSummary', () => {
    it('should return dashboard summary structure', async () => {
      const result = await service.getDashboardSummary();

      expect(result).toHaveProperty('vendors');
      expect(result).toHaveProperty('purchaseOrders');
      expect(result).toHaveProperty('payments');
      expect(result).toHaveProperty('outstanding');
    });
  });

  describe('getVendorOutstanding', () => {
    it('should return array from getVendorOutstanding', async () => {
      const result = await service.getVendorOutstanding();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getPaymentAging', () => {
    it('should return payment aging report structure', async () => {
      const result = await service.getPaymentAging();

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('buckets');
      expect(result).toHaveProperty('byVendor');
    });
  });

  describe('getCashFlowForecast', () => {
    it('should return cash flow forecast structure', async () => {
      const result = await service.getCashFlowForecast();

      expect(result).toHaveProperty('upcoming');
      expect(result).toHaveProperty('total');
    });
  });
});
