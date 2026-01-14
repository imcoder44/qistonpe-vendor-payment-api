# 🏢 MSME Vendor Payment Tracking System

A robust and scalable RESTful API for managing vendor payments, purchase orders, and financial analytics for MSMEs. Built with **NestJS**, **TypeScript**, and **MySQL**.

[![NestJS](https://img.shields.io/badge/NestJS-v11-red.svg)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5-blue.svg)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-v8-orange.svg)](https://www.mysql.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [API Documentation](#-api-documentation)
- [API Endpoints](#-api-endpoints)
- [Authentication](#-authentication)
- [Database Schema](#-database-schema)
- [Testing](#-testing)
- [Bonus Features](#-bonus-features)
- [Architecture Decisions](#-architecture-decisions)

## ✨ Features

### Core Features (MUST-HAVE)
- ✅ **Vendor Management** - Full CRUD operations with GST/PAN validation
- ✅ **Purchase Order Management** - Create POs with line items, auto-generate PO numbers
- ✅ **Payment Recording** - Record payments against POs with multiple payment methods
- ✅ **Payment Tracking** - Real-time tracking of paid/outstanding amounts
- ✅ **Due Date Calculation** - Automatic due date based on vendor payment terms
- ✅ **Analytics** - Vendor outstanding reports and payment aging analysis

### Bonus Features (GOOD-TO-HAVE)
- ⭐ **JWT Authentication** - Secure API endpoints with role-based access
- ⭐ **Swagger/OpenAPI Documentation** - Interactive API docs at `/api/docs`
- ⭐ **Rate Limiting** - Protect against API abuse
- ⭐ **Payment Void Functionality** - Void incorrect payments with audit trail
- ⭐ **Cash Flow Forecasting** - Weekly payment obligation projections
- ⭐ **Dashboard Summary** - Comprehensive business metrics
- ⭐ **Payment Trends** - Monthly and weekly payment analytics
- ⭐ **Audit Trail** - Track who created/modified records and when
- ⭐ **Soft Delete** - Preserve data integrity with soft deletions
- ⭐ **Health Checks** - Kubernetes-ready liveness/readiness probes
- ⭐ **Seed Data** - Quick database population for testing
- ⭐ **Unit Tests** - Comprehensive test coverage

## 🛠 Tech Stack

| Technology | Purpose |
|------------|---------|
| **NestJS v11** | Backend framework with modular architecture |
| **TypeScript** | Type-safe development |
| **TypeORM** | Database ORM with MySQL support |
| **MySQL** | Relational database |
| **Passport + JWT** | Authentication |
| **Swagger/OpenAPI** | API documentation |
| **Class Validator** | Request validation |
| **bcryptjs** | Password hashing |
| **Jest** | Testing framework |

## 📁 Project Structure

```
src/
├── analytics/              # Analytics and reporting module
│   ├── analytics.controller.ts
│   ├── analytics.service.ts
│   └── analytics.module.ts
├── auth/                   # Authentication module
│   ├── decorators/
│   ├── dto/
│   ├── entities/
│   ├── guards/
│   ├── strategies/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── common/                 # Shared utilities
│   ├── entities/           # Base entity with audit fields
│   ├── enums/              # Shared enumerations
│   ├── filters/            # Exception filters
│   └── interceptors/       # Response transformation
├── health/                 # Health check endpoints
├── payments/               # Payment management module
│   ├── dto/
│   ├── entities/
│   ├── payments.controller.ts
│   ├── payments.service.ts
│   └── payments.module.ts
├── purchase-orders/        # PO management module
│   ├── dto/
│   ├── entities/
│   ├── purchase-orders.controller.ts
│   ├── purchase-orders.service.ts
│   └── purchase-orders.module.ts
├── seed/                   # Database seeding
├── vendors/                # Vendor management module
│   ├── dto/
│   ├── entities/
│   ├── vendors.controller.ts
│   ├── vendors.service.ts
│   └── vendors.module.ts
├── app.module.ts           # Root module
└── main.ts                 # Application bootstrap
```

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- MySQL v8+
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/vendor-payment-api.git
cd vendor-payment-api
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. **Create MySQL database**
```sql
CREATE DATABASE vendor_payment_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

5. **Start the application**
```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

6. **Access the API**
- API: http://localhost:3000/api/v1
- Swagger Docs: http://localhost:3000/api/docs
- Health Check: http://localhost:3000/api/v1/health

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL host | localhost |
| `DB_PORT` | MySQL port | 3306 |
| `DB_USERNAME` | MySQL username | root |
| `DB_PASSWORD` | MySQL password | - |
| `DB_NAME` | Database name | vendor_payment_db |
| `JWT_SECRET` | JWT signing key | - |
| `JWT_EXPIRES_IN` | Token expiry | 24h |
| `PORT` | API port | 3000 |
| `SEED_DATA` | Auto-seed on startup | false |

## 📚 API Documentation

Interactive Swagger documentation is available at:
```
http://localhost:3000/api/docs
```

### Sample API Responses

All API responses follow a consistent format:

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-01-14T10:30:00.000Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": 400,
    "message": "Validation failed",
    "details": ["email must be a valid email"]
  },
  "timestamp": "2026-01-14T10:30:00.000Z"
}
```

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login and get JWT token |
| GET | `/auth/profile` | Get current user profile |

### Vendors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/vendors` | List all vendors (paginated) |
| POST | `/vendors` | Create new vendor |
| GET | `/vendors/:id` | Get vendor by ID |
| PATCH | `/vendors/:id` | Update vendor |
| DELETE | `/vendors/:id` | Soft delete vendor |
| GET | `/vendors/:id/payment-summary` | Get vendor payment summary |

### Purchase Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/purchase-orders` | List all POs (paginated) |
| POST | `/purchase-orders` | Create new PO |
| GET | `/purchase-orders/:id` | Get PO by ID |
| PATCH | `/purchase-orders/:id` | Update PO |
| DELETE | `/purchase-orders/:id` | Soft delete PO |
| POST | `/purchase-orders/:id/cancel` | Cancel PO |
| POST | `/purchase-orders/:id/items` | Add item to PO |
| PATCH | `/purchase-orders/:id/items/:itemId` | Update PO item |
| DELETE | `/purchase-orders/:id/items/:itemId` | Remove PO item |
| GET | `/purchase-orders/overdue` | Get overdue POs |
| GET | `/purchase-orders/statistics` | Get PO statistics |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payments` | List all payments (paginated) |
| POST | `/payments` | Record new payment |
| GET | `/payments/:id` | Get payment by ID |
| POST | `/payments/:id/void` | Void a payment |
| GET | `/payments/statistics` | Get payment statistics |
| GET | `/payments/trends` | Get payment trends |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/vendor-outstanding` | Outstanding per vendor |
| GET | `/analytics/payment-aging` | Payment aging report |
| GET | `/analytics/dashboard` | Dashboard summary |
| GET | `/analytics/cash-flow-forecast` | Cash flow projection |
| GET | `/analytics/top-vendors` | Top vendors by outstanding |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check with DB status |
| GET | `/health/ready` | Readiness probe |
| GET | `/health/live` | Liveness probe |

## 🔐 Authentication

The API uses JWT (JSON Web Token) for authentication.

### Getting a Token
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

### Using the Token
```bash
curl http://localhost:3000/api/v1/vendors \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Default Admin User
- Username: `admin`
- Password: `admin123`

## 🗄 Database Schema

### Entity Relationships
```
Vendor (1) ──────────< (N) PurchaseOrder (1) ──────< (N) PurchaseOrderItem
                              │
                              └────────< (N) Payment
```

### Payment Terms
| Term | Days |
|------|------|
| NET_15 | 15 days |
| NET_30 | 30 days |
| NET_45 | 45 days |
| NET_60 | 60 days |
| IMMEDIATE | 0 days |
| ADVANCE | -7 days |

### PO Status Flow
```
PENDING → APPROVED → PARTIALLY_PAID → PAID
    │         │            │
    └─────────┴────────────┴──→ CANCELLED
                           │
                    [due date passes]
                           ↓
                        OVERDUE
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## ⭐ Bonus Features

### 1. Payment Void Functionality
Void incorrect payments with a required reason. The system automatically reverses the payment amount on the PO.

### 2. Cash Flow Forecasting
Get weekly projections of upcoming payment obligations based on PO due dates.

### 3. Payment Aging Report
Analyze overdue payments in buckets:
- 1-30 days
- 31-60 days
- 61-90 days
- 90+ days

### 4. Dashboard Summary
Single endpoint for comprehensive business metrics across vendors, POs, and payments.

### 5. Audit Trail
All entities track:
- `createdAt` - Creation timestamp
- `updatedAt` - Last modification timestamp
- `createdBy` - User who created the record
- `updatedBy` - User who last modified the record
- `deletedAt` - Soft delete timestamp

## 🏗 Architecture Decisions

### Why NestJS?
- Modular architecture for scalability
- Built-in dependency injection
- TypeScript-first design
- Excellent ecosystem (TypeORM, Passport, Swagger)

### Why UUID for IDs?
- No collision risk in distributed systems
- Harder to guess/enumerate
- Database-agnostic generation

### Why Soft Deletes?
- Preserve referential integrity
- Audit trail requirements
- Easy data recovery

### Why Separate DTOs?
- Input validation separation
- API versioning flexibility
- Documentation clarity

### Rate Limiting
- Prevents API abuse
- Configurable per environment
- 100 requests per minute default

## 📝 License

This project is [MIT licensed](LICENSE).

---

Built with ❤️ for QistonPe Backend API Internship Assignment