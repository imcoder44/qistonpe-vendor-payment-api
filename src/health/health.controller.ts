import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Returns the health status of the API and database connection',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'API is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2026-01-14T12:00:00.000Z' },
        uptime: { type: 'number', example: 3600 },
        database: { type: 'string', example: 'connected' },
        version: { type: 'string', example: '1.0.0' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Service is unhealthy',
  })
  async check() {
    const startTime = Date.now();
    let dbStatus = 'connected';
    let dbLatency = 0;

    try {
      const dbStart = Date.now();
      await this.dataSource.query('SELECT 1');
      dbLatency = Date.now() - dbStart;
    } catch (error) {
      dbStatus = 'disconnected';
    }

    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: dbStatus,
        latency: `${dbLatency}ms`,
      },
      memory: {
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      },
    };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Indicates if the service is ready to accept traffic',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service is ready',
  })
  async ready() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ready' };
    } catch (error) {
      return { status: 'not ready', error: error.message };
    }
  }

  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Indicates if the service is alive',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service is alive',
  })
  async live() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }
}
