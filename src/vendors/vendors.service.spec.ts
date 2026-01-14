import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorsService } from './vendors.service';
import { Vendor } from './entities/vendor.entity';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { VendorStatus, PaymentTerms } from '../common/enums';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('VendorsService', () => {
  let service: VendorsService;
  let repository: Repository<Vendor>;

  const mockVendor: Partial<Vendor> = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Vendor',
    email: 'test@vendor.com',
    contactPerson: 'John Doe',
    phoneNumber: '+91 98765 43210',
    paymentTerms: PaymentTerms.NET_30,
    status: VendorStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Use a factory to create fresh mock query builder for each call
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
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[mockVendor], 1]),
    getMany: jest.fn().mockResolvedValue([mockVendor]),
    getOne: jest.fn().mockResolvedValue(mockVendor),
    getCount: jest.fn().mockResolvedValue(0), // Return 0 for hasActivePOs check
    getRawMany: jest.fn().mockResolvedValue([]),
  });

  const mockRepository = {
    create: jest.fn().mockImplementation((dto) => ({ ...dto, id: mockVendor.id })),
    save: jest.fn().mockImplementation((vendor) => Promise.resolve({ ...mockVendor, ...vendor })),
    findOne: jest.fn(),
    find: jest.fn(),
    softRemove: jest.fn(),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorsService,
        {
          provide: getRepositoryToken(Vendor),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<VendorsService>(VendorsService);
    repository = module.get<Repository<Vendor>>(getRepositoryToken(Vendor));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateVendorDto = {
      name: 'New Vendor',
      email: 'new@vendor.com',
      contactPerson: 'Jane Doe',
      phoneNumber: '+91 98765 43211',
      paymentTerms: PaymentTerms.NET_30,
    };

    it('should create a vendor successfully', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null); // No existing vendor

      const result = await service.create(createDto, 'user-id');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: createDto.email },
        withDeleted: true,
      });
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.email).toBe(createDto.email);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockRepository.findOne.mockResolvedValueOnce(mockVendor);

      await expect(service.create(createDto, 'user-id')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a vendor by id', async () => {
      mockRepository.findOne.mockResolvedValueOnce(mockVendor);

      const result = await service.findOne(mockVendor.id!);

      expect(result).toEqual(mockVendor);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockVendor.id },
        relations: ['purchaseOrders'],
      });
    });

    it('should throw NotFoundException if vendor not found', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a vendor successfully', async () => {
      mockRepository.findOne.mockResolvedValueOnce(mockVendor);
      mockRepository.findOne.mockResolvedValueOnce(null); // No duplicate email
      mockRepository.findOne.mockResolvedValueOnce({ ...mockVendor, name: 'Updated Vendor' });

      const updateDto = { name: 'Updated Vendor' };
      const result = await service.update(mockVendor.id!, updateDto, 'user-id');

      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.name).toBe('Updated Vendor');
    });

    it('should throw NotFoundException if vendor not found', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.update('non-existent-id', { name: 'Test' }, 'user-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a vendor with no active POs', async () => {
      // First call for findOne
      mockRepository.findOne.mockResolvedValueOnce(mockVendor);

      await service.remove(mockVendor.id!);

      expect(mockRepository.softRemove).toHaveBeenCalled();
    });

    it('should throw NotFoundException if vendor not found', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated vendors', async () => {
      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toHaveProperty('total');
      expect(result.meta).toHaveProperty('page');
      expect(result.meta).toHaveProperty('limit');
      expect(result.meta).toHaveProperty('totalPages');
    });
  });
});
