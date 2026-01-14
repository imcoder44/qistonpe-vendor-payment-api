import {
  Controller,
  Post,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SeedService } from './seed.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Seed')
@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Seed database with sample data',
    description: 'Creates sample vendors, purchase orders, and payments. Will skip if data already exists.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Database seeded successfully',
  })
  async seed() {
    await this.seedService.seed();
    return { message: 'Database seeded successfully' };
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear all seed data',
    description: 'Removes all vendors, purchase orders, and payments. USE WITH CAUTION!',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All data cleared',
  })
  async clear() {
    await this.seedService.clear();
    return { message: 'All data cleared successfully' };
  }
}
