# Database Credentials for Testing

## 🌐 Live Deployed Database (Railway MySQL)

| Property | Value |
|----------|-------|
| **Host** | interchange.proxy.rlwy.net |
| **Port** | 17888 |
| **Database Name** | railway |
| **Username** | root |
| **Password** | NzuIhMLlVC0eoRNgADnyvPIZ1KDupTaF |

### Connection URL
```
mysql://root:NzuIhMLlVC0eoRNgADnyvPIZ1KDupTaF@interchange.proxy.rlwy.net:17888/railway
```

## 🌐 Live API Access
- **Base URL:** https://qistonpe-vendor-payment-api-production.up.railway.app/api/v1
- **Swagger Docs:** https://qistonpe-vendor-payment-api-production.up.railway.app/api/docs

## 🔐 Default Admin User (for API Login)
- **Username:** admin
- **Password:** admin123

### Login Request
```bash
curl -X POST https://qistonpe-vendor-payment-api-production.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

---

## 💻 Local Development (Optional)

| Property | Value |
|----------|-------|
| **Host** | localhost |
| **Port** | 3306 |
| **Database Name** | vendor_payment_db |
| **Username** | root |
| **Password** | T@n!$#q44 |

### Local Connection String
```
mysql://root:T@n!$#q44@localhost:3306/vendor_payment_db
```

### Setup Instructions

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
