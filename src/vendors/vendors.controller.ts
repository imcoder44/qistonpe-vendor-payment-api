import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { VendorsService } from './vendors.service';
import { CreateVendorDto, UpdateVendorDto, VendorQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@ApiTags('Vendors')
@Controller({ path: 'vendors', version: '1' })
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a new vendor',
    description: 'Creates a new vendor with unique name and email',
  })
  @ApiResponse({
    status: 201,
    description: 'Vendor created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  @ApiResponse({
    status: 409,
    description: 'Vendor with same name or email already exists',
  })
  create(
    @Body() createVendorDto: CreateVendorDto,
    @CurrentUser() user?: { id: string },
  ) {
    return this.vendorsService.create(createVendorDto, user?.id);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all vendors',
    description: 'Retrieve all vendors with optional filtering, searching, and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'List of vendors retrieved successfully',
  })
  findAll(@Query() query: VendorQueryDto) {
    return this.vendorsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get vendor details',
    description: 'Retrieve vendor details with payment summary',
  })
  @ApiParam({
    name: 'id',
    description: 'Vendor UUID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Vendor details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Vendor not found',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.findOneWithSummary(id);
  }

  @Put(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update vendor',
    description: 'Update vendor information',
  })
  @ApiParam({
    name: 'id',
    description: 'Vendor UUID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Vendor updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Vendor not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Vendor with same name or email already exists',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateVendorDto: UpdateVendorDto,
    @CurrentUser() user?: { id: string },
  ) {
    return this.vendorsService.update(id, updateVendorDto, user?.id);
  }

  @Delete(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete vendor',
    description: 'Soft delete a vendor (cannot delete if has active POs)',
  })
  @ApiParam({
    name: 'id',
    description: 'Vendor UUID',
    type: 'string',
  })
  @ApiResponse({
    status: 204,
    description: 'Vendor deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete vendor with active purchase orders',
  })
  @ApiResponse({
    status: 404,
    description: 'Vendor not found',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.remove(id);
  }
}
