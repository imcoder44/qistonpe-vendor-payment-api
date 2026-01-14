import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global Prefix
  app.setGlobalPrefix('api');

  // Global Validation Pipe with transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Exception Filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global Interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('MSME Vendor Payment Tracking API')
    .setDescription(
      `
## QistonPe Vendor Payment Tracking System

A comprehensive backend API for MSMEs to manage vendor payments, purchase orders, and track outstanding balances.

### Features:
- **Vendor Management**: Complete CRUD operations for vendors
- **Purchase Order Management**: Create, track, and manage POs with auto-calculations
- **Payment Recording**: Record payments with automatic PO status updates
- **Analytics**: Outstanding balances, aging reports, and payment trends
- **Authentication**: JWT-based secure authentication
- **Audit Trail**: Track all changes with timestamps and user information

### Business Rules:
- PO numbers auto-generated: PO-YYYYMMDD-XXX
- Payment references auto-generated: PAY-YYYYMMDD-XXX
- Due dates auto-calculated from vendor payment terms
- PO status auto-updates based on payments
- Cannot overpay a purchase order
- Cannot create PO for inactive vendors
      `,
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'User authentication endpoints')
    .addTag('Vendors', 'Vendor management endpoints')
    .addTag('Purchase Orders', 'Purchase order management endpoints')
    .addTag('Payments', 'Payment recording endpoints')
    .addTag('Analytics', 'Analytics and reporting endpoints')
    .addTag('Health', 'Application health check')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'QistonPe API Documentation',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`
╔════════════════════════════════════════════════════════════╗
║     MSME Vendor Payment Tracking API                       ║
║                                                            ║
║     🚀 Server running on: http://localhost:${port}           ║
║     📚 API Docs: http://localhost:${port}/api/docs           ║
║     ⚡ Environment: ${process.env.NODE_ENV || 'development'}                       ║
╚════════════════════════════════════════════════════════════╝
  `);
}
bootstrap();
