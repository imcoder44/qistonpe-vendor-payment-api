import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { Vendor } from './entities/vendor.entity';
import { CreateVendorDto, UpdateVendorDto, VendorQueryDto } from './dto';
import { VendorStatus, PurchaseOrderStatus } from '../common/enums';

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor)
    private readonly vendorRepository: Repository<Vendor>,
  ) {}

  async create(createVendorDto: CreateVendorDto, userId?: string): Promise<Vendor> {
    // Check for duplicate name
    const existingByName = await this.vendorRepository.findOne({
      where: { name: createVendorDto.name },
      withDeleted: true,
    });
    if (existingByName) {
      throw new ConflictException({
        message: `Vendor with name "${createVendorDto.name}" already exists`,
        errorCode: 'VENDOR_NAME_EXISTS',
      });
    }

    // Check for duplicate email
    const existingByEmail = await this.vendorRepository.findOne({
      where: { email: createVendorDto.email },
      withDeleted: true,
    });
    if (existingByEmail) {
      throw new ConflictException({
        message: `Vendor with email "${createVendorDto.email}" already exists`,
        errorCode: 'VENDOR_EMAIL_EXISTS',
      });
    }

    const vendor = this.vendorRepository.create({
      ...createVendorDto,
      createdBy: userId,
      updatedBy: userId,
    });

    return this.vendorRepository.save(vendor);
  }

  async findAll(query: VendorQueryDto) {
    const { status, search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'DESC' } = query;

    const where: FindOptionsWhere<Vendor> = {};

    if (status) {
      where.status = status;
    }

    const queryBuilder = this.vendorRepository.createQueryBuilder('vendor');

    if (status) {
      queryBuilder.andWhere('vendor.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere(
        '(vendor.name LIKE :search OR vendor.email LIKE :search OR vendor.contactPerson LIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Validate sortBy field
    const allowedSortFields = ['name', 'email', 'createdAt', 'updatedAt', 'status'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    queryBuilder
      .orderBy(`vendor.${validSortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [vendors, total] = await queryBuilder.getManyAndCount();

    return {
      data: vendors,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<Vendor> {
    const vendor = await this.vendorRepository.findOne({
      where: { id },
      relations: ['purchaseOrders'],
    });

    if (!vendor) {
      throw new NotFoundException({
        message: `Vendor with ID "${id}" not found`,
        errorCode: 'VENDOR_NOT_FOUND',
      });
    }

    return vendor;
  }

  async findOneWithSummary(id: string) {
    const vendor = await this.findOne(id);

    // Calculate payment summary
    const summary = await this.vendorRepository
      .createQueryBuilder('vendor')
      .leftJoin('vendor.purchaseOrders', 'po')
      .select('vendor.id', 'vendorId')
      .addSelect('COUNT(DISTINCT po.id)', 'totalPOs')
      .addSelect('COALESCE(SUM(po.totalAmount), 0)', 'totalPOAmount')
      .addSelect('COALESCE(SUM(po.paidAmount), 0)', 'totalPaidAmount')
      .addSelect('COALESCE(SUM(po.outstandingAmount), 0)', 'totalOutstanding')
      .addSelect(
        `SUM(CASE WHEN po.status = '${PurchaseOrderStatus.PAID}' THEN 1 ELSE 0 END)`,
        'fullyPaidPOs',
      )
      .addSelect(
        `SUM(CASE WHEN po.status = '${PurchaseOrderStatus.PARTIALLY_PAID}' THEN 1 ELSE 0 END)`,
        'partiallyPaidPOs',
      )
      .addSelect(
        `SUM(CASE WHEN po.status = '${PurchaseOrderStatus.APPROVED}' THEN 1 ELSE 0 END)`,
        'pendingPOs',
      )
      .where('vendor.id = :id', { id })
      .groupBy('vendor.id')
      .getRawOne();

    return {
      ...vendor,
      paymentSummary: {
        totalPurchaseOrders: parseInt(summary?.totalPOs || '0'),
        totalPOAmount: parseFloat(summary?.totalPOAmount || '0'),
        totalPaidAmount: parseFloat(summary?.totalPaidAmount || '0'),
        totalOutstanding: parseFloat(summary?.totalOutstanding || '0'),
        fullyPaidPOs: parseInt(summary?.fullyPaidPOs || '0'),
        partiallyPaidPOs: parseInt(summary?.partiallyPaidPOs || '0'),
        pendingPOs: parseInt(summary?.pendingPOs || '0'),
      },
    };
  }

  async update(id: string, updateVendorDto: UpdateVendorDto, userId?: string): Promise<Vendor> {
    const vendor = await this.findOne(id);

    // Check for duplicate name if updating name
    if (updateVendorDto.name && updateVendorDto.name !== vendor.name) {
      const existingByName = await this.vendorRepository.findOne({
        where: { name: updateVendorDto.name },
      });
      if (existingByName) {
        throw new ConflictException({
          message: `Vendor with name "${updateVendorDto.name}" already exists`,
          errorCode: 'VENDOR_NAME_EXISTS',
        });
      }
    }

    // Check for duplicate email if updating email
    if (updateVendorDto.email && updateVendorDto.email !== vendor.email) {
      const existingByEmail = await this.vendorRepository.findOne({
        where: { email: updateVendorDto.email },
      });
      if (existingByEmail) {
        throw new ConflictException({
          message: `Vendor with email "${updateVendorDto.email}" already exists`,
          errorCode: 'VENDOR_EMAIL_EXISTS',
        });
      }
    }

    Object.assign(vendor, updateVendorDto, { updatedBy: userId });
    return this.vendorRepository.save(vendor);
  }

  async remove(id: string): Promise<void> {
    const vendor = await this.findOne(id);

    // Check if vendor has any non-draft purchase orders
    const hasActivePOs = await this.vendorRepository
      .createQueryBuilder('vendor')
      .leftJoin('vendor.purchaseOrders', 'po')
      .where('vendor.id = :id', { id })
      .andWhere('po.status != :status', { status: PurchaseOrderStatus.CANCELLED })
      .andWhere('po.deletedAt IS NULL')
      .getCount();

    if (hasActivePOs > 0) {
      throw new BadRequestException({
        message: 'Cannot delete vendor with active purchase orders',
        errorCode: 'VENDOR_HAS_ACTIVE_POS',
      });
    }

    await this.vendorRepository.softRemove(vendor);
  }

  async isActive(id: string): Promise<boolean> {
    const vendor = await this.findOne(id);
    return vendor.status === VendorStatus.ACTIVE;
  }

  async getVendorPaymentTerms(id: string): Promise<number> {
    const vendor = await this.findOne(id);
    return vendor.paymentTerms;
  }
}
