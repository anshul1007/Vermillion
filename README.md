# Vermillion - Microservices Platform

Enterprise-grade microservices platform for Attendance Management and Construction Site Entry/Exit Tracking with centralized authentication.

## 🏗️ Architecture

### Microservices

1. **Auth API** (Port: 5275)
   - Centralized authentication and authorization
   - Multi-tenant support (Attendance, Entry/Exit)
   - JWT token generation and validation
   - User and tenant management
   - SSO-ready for Zoho integration
   - Database: `AuthDB_Dev`

2. **Attendance API** (Port: 5000)
   - Employee attendance tracking
   - Leave management and approvals
   - Admin dashboard and reporting
   - Role-based access control
   - Database: `AttendanceDB_Dev`
   - Tenant: `attendance`

3. **Entry/Exit API** (Port: 5001)
   - Construction site worker/visitor tracking
   - Labour registration with barcode scanning
   - Entry/exit logging with photo capture
   - Project and contractor management
   - Offline sync support for mobile
   - Field-level encryption for sensitive data
   - Database: `EntryExitDB_Dev`
   - Tenant: `entryexit`

### Technology Stack

**Backend**
- .NET 8 Web API
- Entity Framework Core 8
- SQL Server LocalDB
- JWT Bearer Authentication
- BCrypt password hashing
- ASP.NET Data Protection (encryption)

**Frontend**
- Angular 18 (standalone components)
- Capacitor (for mobile deployment)
- Capacitor SQLite (offline storage)
- ZXing (barcode scanning)
- Capacitor Camera (photo capture)

**Mobile Capabilities**
- Camera-based barcode scanning
- Photo capture (mandatory for registrations)
- Offline-first architecture with sync queue
- SQLite local database
- Network status detection

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- .NET 8 SDK
- SQL Server LocalDB
- PowerShell 5.1+

### Start All Services

```powershell
.\scripts\start-all-services.ps1
```

This will start:
- Auth API: http://localhost:5275/swagger
- Attendance API: http://localhost:5000/swagger
- Entry/Exit API: http://localhost:5001/swagger

### Manual Start

```powershell
# Terminal 1: Auth API
cd backend\AuthAPI
dotnet run

# Terminal 2: Attendance API
cd backend\AttendanceAPI
dotnet run

# Terminal 3: Entry/Exit API
cd backend\EntryExitAPI
dotnet run
```

## 📚 Documentation

- [Microservices Integration Guide](MICROSERVICES_INTEGRATION_GUIDE.md)
- [Auth API Documentation](backend/AuthAPI/README.md)
- [API Documentation](API_DOCUMENTATION.md)
- [Feature Toggles](FEATURE_TOGGLE_IMPLEMENTATION.md)
- [System User Guide](SYSTEM_USER_GUIDE.md)
- [Test Credentials](TEST_CREDENTIALS.md)
- [Setup Guide](SETUP_GUIDE.md)
- [Quick Start Guide](QUICK_START.md)

## 🔐 Default Credentials

### Attendance System Admin
- **Username**: `admin`
- **Password**: `Admin@123`
- **Tenant Domain**: `attendance`
- **Email**: `admin@attendance.com`

### Entry/Exit System Admin
- **Username**: `admin`
- **Password**: `Admin@123`
- **Tenant Domain**: `entryexit`
- **Email**: `admin@entryexit.com`

## 🗄️ Databases

All databases use SQL Server LocalDB `(localdb)\MSSQLLocalDB`:

1. **AuthDB_Dev** - Authentication and tenant data
   - Tables: Tenants, Users, RefreshTokens

2. **AttendanceDB_Dev** - Attendance management
   - Tables: Employees, AttendanceRecords, LeaveRequests, etc.

3. **EntryExitDB_Dev** - Entry/exit tracking
   - Tables: Projects, Contractors, Labours, LabourRegistrations, Visitors, EntryExitRecords

## 🔑 Key Features

### Auth API
- ✅ Multi-tenant architecture
- ✅ JWT access tokens (60 min) and refresh tokens (7 days)
- ✅ Role-based authorization
- ✅ Token revocation
- ✅ SSO infrastructure for Zoho (future)
- ✅ BCrypt password hashing

### Attendance API
- ✅ Clock in/out tracking
- ✅ Leave request workflow
- ✅ Approval system
- ✅ Admin dashboard
- ✅ Feature toggles
- ✅ System users

### Entry/Exit API
- ✅ Labour registration with barcode
- ✅ Visitor management
- ✅ Entry/exit logging with photos
- ✅ Project and contractor tracking
- ✅ Double-entry prevention
- ✅ Offline sync for mobile
- ✅ Field-level encryption (Aadhar)
- ✅ Batch sync endpoint

## 📱 Mobile App (Entry/Exit)

### Features
- Camera-based barcode scanning (no hardware scanner needed)
- Mandatory photo capture for registrations
- Offline mode with local SQLite database
- Auto-sync when network available
- Double-entry prevention
- Search by barcode or name

### Setup
```bash
cd frontend-mobile
npm install
npx cap sync android
npx cap open android
```

## 🔧 Development

### Add New Migration
```powershell
# Auth API
cd backend\AuthAPI
dotnet ef migrations add MigrationName
dotnet ef database update

# Attendance API
cd backend\AttendanceAPI
dotnet ef migrations add MigrationName
dotnet ef database update

# Entry/Exit API
cd backend\EntryExitAPI
dotnet ef migrations add MigrationName
dotnet ef database update
```

### Testing APIs

#### Login to Auth API
```powershell
Invoke-WebRequest -Uri "http://localhost:5275/api/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"Admin@123","tenantDomain":"attendance"}'
```

#### Call Protected Endpoint
```powershell
$token = "your-jwt-token-here"
Invoke-WebRequest -Uri "http://localhost:5001/api/labour" -Method GET -Headers @{"Authorization"="Bearer $token"}
```

## 🔄 Authentication Flow

1. **User logs in** → Auth API validates credentials → Returns JWT access token + refresh token
2. **User accesses feature** → Frontend sends request with `Authorization: Bearer {token}`
3. **API validates JWT** → Extracts user info (userId, role, tenantDomain) → Processes request
4. **Token expires** → Frontend calls `/api/auth/refresh` → Gets new tokens
5. **User logs out** → Frontend calls `/api/auth/revoke` → Token marked as revoked

## 🎯 Tenant Architecture

Each application is registered as a **tenant** in Auth API:

- **Tenant Domain**: Unique identifier (`attendance`, `entryexit`)
- **Isolated Users**: Users belong to one tenant
- **Shared JWT Secret**: All APIs validate tokens using same secret
- **Tenant Claims**: JWT includes `TenantId` and `TenantDomain` claims

This enables:
- Single sign-on across apps (future)
- Centralized user management
- Role-based access per tenant
- Easy addition of new microservices

## 🛡️ Security

- ✅ JWT-based authentication
- ✅ BCrypt password hashing (cost factor 10)
- ✅ Token expiration and refresh
- ✅ Token revocation support
- ✅ Field-level encryption for PII (Aadhar)
- ✅ CORS configured
- ⚠️ HTTPS recommended for production
- ⚠️ Move JWT secret to environment variables/Azure Key Vault in production

## 🔮 Future Enhancements

- [ ] Zoho SSO integration
- [ ] API Gateway (optional, currently direct API calls)
- [ ] Rate limiting
- [ ] API key authentication for app-to-app calls
- [ ] Audit logging
- [ ] Real-time notifications (SignalR)
- [ ] Mobile app for Attendance system
- [ ] Geolocation tracking for attendance

## 📋 Project Structure

```
Vermillion/
├── backend/
│   ├── AuthAPI/              # Authentication microservice
│   ├── AttendanceAPI/        # Attendance management
│   └── EntryExitAPI/         # Entry/exit tracking
├── frontend/                 # Angular web app (Attendance)
├── frontend-mobile/          # Capacitor mobile app (Entry/Exit)
├── scripts/                  # Utility scripts
│   └── start-all-services.ps1
└── docs/                     # Documentation
```

## 📝 License

MIT License

## 👨‍💻 Contributing

Please read [CONTRIBUTING.md](docs/CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

---

**Version**: 2.0.0  
**Last Updated**: October 29, 2025
