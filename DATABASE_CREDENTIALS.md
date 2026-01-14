# Database Credentials for Testing

## MySQL Database

| Property | Value |
|----------|-------|
| **Host** | localhost |
| **Port** | 3306 |
| **Database Name** | vendor_payment_db |
| **Username** | root |
| **Password** | T@n!$#q44 |

## Connection String
```
mysql://root:T@n!$#q44@localhost:3306/vendor_payment_db
```

## Setup Instructions

1. **Create the database:**
```sql
CREATE DATABASE vendor_payment_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. **Configure environment:**
   - Copy `.env.example` to `.env`
   - Update the database credentials if different

3. **Start the application:**
```bash
npm install
npm run start:dev
```

4. **Tables will be auto-created** on first run (TypeORM synchronize is enabled)

5. **Sample data will be seeded** automatically on startup

## Default Admin User
- **Username:** admin
- **Password:** admin123

## API Access
- **Base URL:** http://localhost:3000/api/v1
- **Swagger Docs:** http://localhost:3000/api/docs
