# Vermillion - Modular Monolithic Platform

Enterprise-grade modular monolithic platform for Attendance Management and Construction Site Entry/Exit Tracking with centralized authentication.

## 🏗️ Architecture

### Unified API with Domain Modules

**Vermillion.API** (Port: 5000)
- Single unified API hosting three domain modules
- Centralized authentication and authorization
- Multi-tenant support (Attendance, Entry/Exit)
- JWT token generation and validation
- Domain-driven design with clear boundaries
- Database: `VermillionDB_Dev` (single database, four schemas)

### Domain Modules

1. **Auth Domain** (`auth` schema) - Authentication and user management
2. **Attendance Domain** (`attendance` schema) - Employee attendance and leave tracking
3. **EntryExit Domain** (`entryexit` schema) - Construction site entry/exit tracking
4. **Shared Domain** (`shared` schema) - Audit logging and feature toggles

**📖 For detailed architecture documentation, see [ARCHITECTURE.md](ARCHITECTURE.md)**

### Technology Stack

**Backend**
- .NET 8 Web API
- Entity Framework Core 8
- SQL Server LocalDB (dev) / Azure SQL (prod)
- JWT Bearer Authentication
- BCrypt password hashing
- ASP.NET Data Protection (encryption)

**Frontend**
- Angular 18+ (standalone components)
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

### Start the Unified API

```bash
cd backend/Vermillion.API
dotnet run
```

This will start the unified API on:
- Main API: http://localhost:5000
- Swagger UI: http://localhost:5000/swagger

All domain endpoints are available:
- Auth: http://localhost:5000/api/auth/*
- Attendance: http://localhost:5000/api/attendance/*
- EntryExit: http://localhost:5000/api/entryexit/*

### Start Frontend Applications

### Frontend Applications

**Web App (Attendance System):**
```bash
cd frontend
npm install
npm start
```

**Mobile App (Entry/Exit System):**
```bash
cd frontend-mobile
npm install
npm start
```

---

## 📚 Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Complete architecture documentation, refactoring summary, and improvement roadmap
- **[CLAUDE.md](CLAUDE.md)** - AI assistant context and development guide
- **[docs/IUSERSERVICE_IMPLEMENTATION.md](docs/IUSERSERVICE_IMPLEMENTATION.md)** - Step-by-step guide for replacing HTTP calls with direct service calls
- **[docs/DATABASE-MIGRATIONS.md](docs/DATABASE-MIGRATIONS.md)** - Database migration guide
- **[docs/CLAUDE_SETUP.md](docs/CLAUDE_SETUP.md)** - Development environment setup
- **[docs/SYSTEM-ADMIN-INTERFACE.md](docs/SYSTEM-ADMIN-INTERFACE.md)** - Admin interface documentation
- **[docs/ENTRY-EXIT-SYSTEM.md](docs/ENTRY-EXIT-SYSTEM.md)** - Entry/Exit system documentation

---

## 📚 Documentation

- [CLAUDE.md](CLAUDE.md) - Complete project reference and development guide
- [REFACTORING_COMPLETE.md](REFACTORING_COMPLETE.md) - Monolithic refactoring details
- [Database Migrations](docs/DATABASE-MIGRATIONS.md) - Migration and seeder management
- [Auth Setup](docs/CLAUDE_SETUP.md) - Role/authorization rules
- [Entry/Exit System](docs/ENTRY-EXIT-SYSTEM.md) - Entry/Exit system specifics
- [System Admin](docs/SYSTEM-ADMIN-INTERFACE.md) - System admin UI details

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

## 🗄️ Database Structure

Single database `VermillionDB_Dev` with four schemas:

1. **auth** - Authentication and tenant data
   - Tables: Tenants, Users, Roles, Permissions, UserRoles, RolePermissions, RefreshTokens, Departments, Employees

2. **attendance** - Attendance management
   - Tables: Attendances, LeaveRequests, LeaveEntitlements, PublicHolidays

3. **entryexit** - Entry/exit tracking
   - Tables: Projects, Contractors, GuardProjectAssignments, Labours, LabourRegistrations, Visitors, EntryExitRecords

4. **shared** - Cross-cutting infrastructure
   - Tables: AuditLogs, FeatureToggles

## 🔑 Key Features

### Auth Domain
- Multi-tenant architecture
- JWT access tokens (60 min) and refresh tokens (7 days)
- Role-based authorization
- Token revocation
- SSO infrastructure for Zoho (future)
- BCrypt password hashing

### Attendance Domain
- Clock in/out tracking
- Leave request workflow
- Approval system
- Admin dashboard
- Feature toggles
- Team management

### EntryExit Domain
- Labour registration with barcode
- Visitor management
- Entry/exit logging with photos
- Project and contractor tracking
- Double-entry prevention
- Offline sync for mobile
- Field-level encryption (Aadhar)
- Batch sync endpoint

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
```bash
cd backend/Vermillion.API

# Create migration for specific domain
dotnet ef migrations add MigrationName --context AuthDbContext --output-dir Migrations/Auth
dotnet ef migrations add MigrationName --context AttendanceDbContext --output-dir Migrations/Attendance
dotnet ef migrations add MigrationName --context EntryExitDbContext --output-dir Migrations/EntryExit
dotnet ef migrations add MigrationName --context SharedDbContext --output-dir Migrations/Shared

# Apply migration
dotnet ef database update --context AuthDbContext
```

### Testing APIs

#### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123","tenantDomain":"attendance"}'
```

#### Call Protected Endpoint
```bash
curl -X GET http://localhost:5000/api/labour \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔄 Authentication Flow

1. **User logs in** → Auth domain validates credentials → Returns JWT access token + refresh token
2. **User accesses feature** → Frontend sends request with `Authorization: Bearer {token}`
3. **API validates JWT** → Extracts user info (userId, role, tenantDomain) → Routes to domain controller
4. **Token expires** → Frontend calls `/api/auth/refresh` → Gets new tokens
5. **User logs out** → Frontend calls `/api/auth/revoke` → Token marked as revoked

## 🎯 Tenant Architecture

Each application is registered as a **tenant**:

- **Tenant Domain**: Unique identifier (`attendance`, `entryexit`)
- **Isolated Users**: Users belong to one or more tenants
- **Shared JWT Secret**: Single JWT configuration for all domains
- **Tenant Claims**: JWT includes `TenantId` and `TenantDomain` claims

This enables:
- Single sign-on across domains
- Centralized user management
- Role-based access per tenant
- Easy addition of new domains

## 🛡️ Security

- JWT-based authentication
- BCrypt password hashing (cost factor 10)
- Token expiration and refresh
- Token revocation support
- Field-level encryption for PII (Aadhar)
- CORS configured
- HTTPS recommended for production
- Move JWT secret to environment variables/Azure Key Vault in production

## 📋 Project Structure

```
Vermillion/
├── backend/
│   ├── Vermillion.API/              # Unified API host
│   │   ├── Controllers/             # All domain controllers
│   │   ├── Extensions/              # Service registration
│   │   ├── Middleware/              # Global middleware
│   │   ├── Program.cs               # Startup configuration
│   │   └── appsettings.json         # Unified configuration
│   ├── Vermillion.Auth.Domain/      # Auth domain library
│   ├── Vermillion.Attendance.Domain/# Attendance domain library
│   ├── Vermillion.EntryExit.Domain/ # EntryExit domain library
│   └── Vermillion.Shared.Domain/    # Shared infrastructure
├── frontend/                         # Angular web app (Attendance)
├── frontend-mobile/                  # Capacitor mobile app (Entry/Exit)
└── docs/                             # Documentation
```

## 🎯 Benefits of Monolithic Architecture

### Infrastructure Simplification
- **APIs**: 3 separate → 1 unified (66% reduction)
- **Databases**: 3 separate → 1 with 4 schemas (66% reduction)
- **Ports**: 3 (5275, 5000, 5001) → 1 (5000)
- **Deployments**: 3 pipelines → 1 pipeline (66% reduction)

### Performance Improvements
- **Inter-domain calls**: Direct method calls instead of HTTP (~95% faster)
- **Shared caching**: Single `IMemoryCache` across all domains
- **Database connections**: Pooled across all domains

### Developer Experience
- **Single codebase**: All domains in one place
- **Unified configuration**: One appsettings file
- **Easier debugging**: Single process, full stack traces
- **Simpler deployment**: One build, one deploy

### Maintainability
- **Domain boundaries preserved**: Clear separation via namespaces and schemas
- **Future-proof**: Can re-split into microservices if needed
- **Consistent patterns**: Same authentication, logging, configuration

## 🔮 Future Enhancements

- Zoho SSO integration
- Rate limiting
- API key authentication for app-to-app calls
- Real-time notifications (SignalR)
- Mobile app for Attendance system
- Geolocation tracking for attendance

## 📝 License

MIT License

## 👨‍💻 Contributing

Please read [CONTRIBUTING.md](docs/CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

---

**Version**: 3.0.0 (Monolithic Architecture)
**Last Updated**: November 15, 2025
