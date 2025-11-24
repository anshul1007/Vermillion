# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vermillion is an enterprise-grade **modular monolithic platform** with a unified API serving three domain modules (Auth, Attendance, EntryExit) and two frontends (web Angular app, mobile Capacitor app). The system provides centralized authentication with multi-tenant support for attendance management and construction site entry/exit tracking.

**Tech Stack:**
- Backend: .NET 8 Web API, Entity Framework Core 8, SQL Server
- Frontend: Angular 20+ (standalone components), Capacitor 7 (mobile)
- Authentication: JWT Bearer tokens with refresh token support
- Database: SQL Server LocalDB (dev), Azure SQL (production)

## Essential Commands

### Backend Development

**Start the unified API:**
```bash
cd backend/Vermillion.API
dotnet run
```

The API will start on **http://localhost:5000** with Swagger UI available at **http://localhost:5000/swagger**

**Build and test:**
```bash
# Build solution
dotnet build Vermillion.sln

# Build specific project
dotnet build backend/Vermillion.API/Vermillion.API.csproj

# Run tests (if available)
dotnet test
```

**Database migrations:**
```bash
# Navigate to unified API project
cd backend/Vermillion.API

# Create migrations for each domain
dotnet ef migrations add MigrationName --context AuthDbContext --output-dir Migrations/Auth
dotnet ef migrations add MigrationName --context AttendanceDbContext --output-dir Migrations/Attendance
dotnet ef migrations add MigrationName --context EntryExitDbContext --output-dir Migrations/EntryExit
dotnet ef migrations add MigrationName --context SharedDbContext --output-dir Migrations/Shared

# Apply migrations
dotnet ef database update --context AuthDbContext
dotnet ef database update --context AttendanceDbContext
dotnet ef database update --context EntryExitDbContext
dotnet ef database update --context SharedDbContext

# Rollback migration
dotnet ef database update PreviousMigrationName --context AuthDbContext
```

### Frontend Development

**Web application (Attendance system):**
```bash
cd frontend
npm install
npm start  # Runs on http://localhost:4200
npm run build
npm test
```

**Mobile application (Entry/Exit system):**
```bash
cd frontend-mobile
npm install
npm start  # Dev server on http://localhost:8100

# Capacitor sync and build
npx cap sync android
npx cap open android
npx cap sync ios
npx cap open ios
```

## Architecture

### Unified API with Domain Separation

**Vermillion.API** (Port 5000) - Unified API hosting three domain modules:

1. **Auth Domain** - Authentication and authorization
   - Issues JWT tokens (60 min access, 7 day refresh)
   - Manages tenants, users, roles, permissions
   - Multi-tenant architecture with tenant domains: `attendance`, `entryexit`
   - Routes: `/api/auth/*`, `/api/tenant/*`, `/api/users/*`
   - Database schema: `auth`

2. **Attendance Domain** - Employee attendance tracking
   - Clock in/out, leave management, approvals
   - Role-based access: SystemAdmin > Admin > Manager > Employee
   - Routes: `/api/attendance/*`, `/api/leave/*`, `/api/approval/*`
   - Database schema: `attendance`

3. **EntryExit Domain** - Construction site worker/visitor tracking
   - Labour/visitor registration with barcode scanning
   - Entry/exit logging with photo capture
   - Offline sync support for mobile app
   - Field-level encryption for sensitive data (Aadhar numbers)
   - Routes: `/api/labour/*`, `/api/visitor/*`, `/api/records/*`, `/api/entryexit/*`
   - Database schema: `entryexit`

4. **Shared Domain** - Cross-cutting infrastructure
   - Audit logging
   - Feature toggles
   - Database schema: `shared`

**Single Database:** `VermillionDB_Dev` with four schemas (auth, attendance, entryexit, shared)

### Domain Project Structure

```
backend/
├── Vermillion.API/                    # Unified API host
│   ├── Controllers/                   # All controllers
│   ├── Extensions/                    # Service registration extensions
│   ├── Middleware/                    # Global middleware
│   ├── Program.cs                     # Startup configuration
│   └── appsettings.json              # Unified configuration
│
├── Vermillion.Auth.Domain/            # Auth domain library
│   ├── Data/AuthDbContext.cs         # Auth DbContext (auth schema)
│   ├── Models/                        # Entities and DTOs
│   └── Services/                      # Auth services
│
├── Vermillion.Attendance.Domain/      # Attendance domain library
│   ├── Data/AttendanceDbContext.cs   # Attendance DbContext (attendance schema)
│   ├── Models/                        # Entities and DTOs
│   └── Services/                      # Attendance services
│
├── Vermillion.EntryExit.Domain/       # EntryExit domain library
│   ├── Data/EntryExitDbContext.cs    # EntryExit DbContext (entryexit schema)
│   ├── Models/                        # Entities and DTOs
│   └── Services/                      # EntryExit services
│
└── Vermillion.Shared.Domain/          # Shared infrastructure library
    ├── Data/SharedDbContext.cs       # Shared DbContext (shared schema)
    ├── Models/                        # Shared entities
    └── Services/                      # Shared services
```

### Authentication Flow

JWT validation is configured once in the unified API:
- **Issuer/Audience**: Configured in `appsettings.json` under `Jwt:Issuer` and `Jwt:Audience`
- **Secret Key**: JWT secret in `Jwt:Key`
- **Token Claims**: `sub` (userId), `email`, `tenants` (JSON array with roles), `role:{domain}`, standard `ClaimTypes.Role`

**Token lifecycle:**
1. User logs in → Auth domain validates credentials → Returns access + refresh tokens
2. Client includes token in `Authorization: Bearer {token}` header
3. API validates JWT → Extracts user/role/tenant claims → Routes to appropriate domain controller
4. Token expires (60 min) → Client calls `/api/auth/refresh` → Gets new tokens
5. User logs out → Client calls `/api/auth/revoke` → Refresh token marked as revoked

### Role Hierarchy

**SystemAdmin** (highest privilege)
- Can perform any action any other role can perform
- Access to System Administration UI/API for tenant, role, permission management
- Protected endpoints: `[Authorize(Roles = "SystemAdmin")]`

**Admin**
- Full access to tenant-specific data (all attendance records, all entry/exit data)
- Can manage users within their tenant
- Cannot modify roles, permissions, or tenants (SystemAdmin only)

**Manager**
- Access to their direct team members only
- Enforced via `GetManagerTeamUserIdsAsync` in Attendance domain
- Can approve leave requests for team members

**Employee**
- Access to their own attendance data
- Can clock in/out, submit leave requests

**Guard**
- Mobile-only role for EntryExit domain
- Does NOT access web frontend
- Can perform labour/visitor check-in/out operations
- Explicitly filtered out from Attendance domain user lists

### Frontend Architecture

**Web App (frontend/)** - Standalone Angular components
- Structure: `app/core/` (auth, interceptors, services), `app/features/` (role-based dashboards), `app/shared/` (components)
- Features: `admin/`, `employee/`, `manager/`, `system/`, `system-admin/`
- Authentication: JWT interceptor adds token to requests, auth guard protects routes
- Services call Vermillion.API endpoints

**Mobile App (frontend-mobile/)** - Capacitor-based Ionic Angular
- Structure: `app/core/` (auth, services), `app/features/` (registration, entry/exit, dashboard)
- Key capabilities:
  - Offline-first with SQLite (`@capacitor-community/sqlite`)
  - Camera barcode scanning (`@zxing/browser`)
  - Photo capture (`@capacitor/camera`)
  - Network status detection (`@capacitor/network`)
  - Sync queue for offline operations (syncs when online)
- Services: `api.service.ts`, `local-db.service.ts`, `sync.service.ts`, `barcode.service.ts`, `photo.service.ts`
- Calls Vermillion.API endpoints

### Database Migrations

**IMPORTANT:** Migrations are disabled by default in production (controlled by `RUN_MIGRATIONS` env var or `RunMigrations` config).

**Production migrations:**
- Use GitHub Actions workflow: `.github/workflows/run-migrations.yml`
- Manual trigger with environment selection (prod/dev/staging)
- Can run seeders separately from migrations
- Must specify DbContext (AuthDbContext, AttendanceDbContext, EntryExitDbContext, SharedDbContext)

**Development:**
- Migrations run automatically on startup in Development environment
- Each domain has migrations in `backend/Vermillion.API/Migrations/[Domain]/` folder
- Use EF Core migration commands with `--context` parameter

### Key Service Implementations

**Auth Domain Services:**
- `JwtService`: Token generation with tenant/role claims
- `AuthService`: Login, token refresh, revocation
- `TenantService`: Multi-tenant management
- `UserService`: User management operations
- `IdentitySeeder`: Seeds default admin users and tenants

**Attendance Domain Services:**
- `TeamManagementHelper`: Manager team member filtering
- `CurrentUserService`: Extracts current user from JWT claims

**EntryExit Domain Services:**
- `AdminService`: Projects, contractors, guards management
- `LabourService`: Labour registration with barcode generation
- `VisitorService`: Visitor registration
- `EntryExitRecordService`: Entry/exit logging with double-entry prevention
- `SyncService`: Batch sync endpoint for mobile offline operations
- `PhotoStorageService`: Photo storage to `wwwroot/photos`
- `EncryptionService`: Field-level encryption using ASP.NET Data Protection
- `EntryExitSeeder`: Seeds sample data for EntryExit domain

**Shared Domain Services:**
- `SharedSeeder`: Seeds audit logs and feature toggles
- `DatabaseFeatureDefinitionProvider`: Feature toggles from database

### Important Patterns

**Tenant Filtering:**
- Controllers extract tenant from JWT: `User.FindFirst("tenantDomain")?.Value`
- Queries filter by `TenantId` or verify tenant domain matches
- Cross-tenant access is prevented at API level

**Role-Based Authorization:**
- Use `[Authorize(Roles = "SystemAdmin")]` for SystemAdmin-only endpoints
- Use `[Authorize(Roles = "Admin,SystemAdmin")]` for admin operations
- Manager-level checks use service layer filtering (e.g., `GetManagerTeamUserIdsAsync`)
- Guards role explicitly excluded from Attendance domain

**Offline Sync (Mobile):**
- Operations queued in local SQLite when offline
- `SyncService.queueOperation()` stores pending operations
- `SyncService.attemptSync()` sends batch to `/api/entryexit/sync-batch`
- Server validates and processes operations, returns results with client IDs
- Client updates local DB and removes synced operations

**Field Encryption:**
- Sensitive fields (Aadhar numbers) encrypted with `EncryptionService`
- Uses ASP.NET Data Protection API with application name as key
- Encrypt before save, decrypt on retrieval

**Schema Separation:**
- Each domain has its own DbContext with dedicated schema
- `AuthDbContext` → `auth` schema
- `AttendanceDbContext` → `attendance` schema
- `EntryExitDbContext` → `entryexit` schema
- `SharedDbContext` → `shared` schema
- All contexts share the same database connection string

## Common Development Workflows

### Adding a New Migration

1. Make model changes in `backend/Vermillion.[Domain].Domain/Models/Entities/`
2. Update `DbContext` in `backend/Vermillion.[Domain].Domain/Data/` if needed
3. Navigate to unified API: `cd backend/Vermillion.API`
4. Create migration: `dotnet ef migrations add YourMigrationName --context [Domain]DbContext --output-dir Migrations/[Domain]`
5. Review generated migration in `Migrations/[Domain]/` folder
6. Apply locally: `dotnet ef database update --context [Domain]DbContext`
7. Test thoroughly before committing

### Adding a New API Endpoint

1. Create/update DTO in `backend/Vermillion.[Domain].Domain/Models/DTOs/`
2. Add endpoint to appropriate controller in `backend/Vermillion.API/Controllers/`
3. Add `[Authorize(Roles = "...")]` attribute for role-based access
4. Implement business logic in `backend/Vermillion.[Domain].Domain/Services/` if complex
5. Test with `.http` files (e.g., `Vermillion.API.http`)

### Adding a New Frontend Feature

1. Create feature component in `app/features/[feature-name]/`
2. Add route in `app.routes.ts` with auth guard
3. Create service in `app/core/services/` for API calls
4. Use dependency injection: `private api = inject(ApiService)`
5. Handle authentication errors (401/403) to redirect to login

### Debugging JWT Issues

- Check `Jwt:Key`, `Jwt:Issuer`, and `Jwt:Audience` in `appsettings.json`
- Enable JWT logging: API has `OnAuthenticationFailed` and `OnTokenValidated` event handlers
- Verify role claims are present: check `role:{domain}` or `ClaimTypes.Role`
- Decode token at jwt.io to inspect claims

## Configuration Files

**Backend appsettings structure:**
- `appsettings.json` - Base configuration (Logging, AllowedHosts, Cors, Jwt)
- `appsettings.Development.json` - LocalDB connection strings, dev settings
- `appsettings.Production.json` - Azure SQL connection strings, prod settings

**Key configuration sections:**
- `ConnectionStrings:DefaultConnection` - Single database connection (shared across all domains)
- `Jwt:Key`, `Jwt:Issuer`, `Jwt:Audience` - JWT configuration
- `SeedOnStartup` - Controls whether seeders run on startup
- `RunMigrations` - Controls whether migrations run on startup (false in prod)
- `Cors:AllowedOrigins` - CORS origins for frontend apps

**Frontend environment files:**
- `frontend/src/environments/environment.ts` - Dev API URL (http://localhost:5000)
- `frontend/src/environments/environment.prod.ts` - Production API URL
- `frontend-mobile/src/environments/` - Same structure for mobile

## Testing Credentials

### Attendance System
- **Username**: `admin`
- **Password**: `Admin@123`
- **Tenant Domain**: `attendance`

### Entry/Exit System
- **Username**: `admin`
- **Password**: `Admin@123`
- **Tenant Domain**: `entryexit`

## Important Constraints

1. **Guards are mobile-only** - Do not show guards in web frontend user lists, they are filtered in `GetUsers` endpoint
2. **Manager data access** - Always enforce team member filtering for Manager role using `GetManagerTeamUserIdsAsync`
3. **SystemAdmin protection** - Assigning/removing SystemAdmin role requires caller to be SystemAdmin
4. **Multi-tenant isolation** - Always filter by tenant, never allow cross-tenant data access
5. **Migrations in production** - Never enable automatic migrations in production, use GitHub Actions workflow
6. **JWT secret security** - In production, move JWT secrets to Azure Key Vault or environment variables
7. **Field encryption** - Always encrypt PII fields (Aadhar) using `EncryptionService` before saving
8. **Schema separation** - Always use correct DbContext for each domain to maintain schema boundaries

## Controllers in Unified API

**Auth Domain Controllers** (in `backend/Vermillion.API/Controllers/`):
- `AuthController.cs` - Login, token refresh, logout
- `TenantController.cs` - Tenant management (SystemAdmin)
- `UsersController.cs` - User management
- `AuthAdminController.cs` - Auth domain administrative operations

**Attendance Domain Controllers:**
- `AttendanceController.cs` - Clock in/out operations
- `LeaveController.cs` - Leave request management
- `ApprovalController.cs` - Leave approval workflows
- `AttendanceAdminController.cs` - Attendance administrative operations

**EntryExit Domain Controllers:**
- `LabourController.cs` - Labour registration and management
- `VisitorController.cs` - Visitor registration and management
- `RecordsController.cs` - Entry/exit record operations
- `SyncController.cs` - Mobile offline sync
- `EntryExitAdminController.cs` - Projects, contractors, guards management

## Related Documentation

- `README.md` - Quick start guide and architecture overview
- `REFACTORING_COMPLETE.md` - Details on the monolithic refactoring
- `docs/DATABASE-MIGRATIONS.md` - Migration and seeder management
- `docs/CLAUDE_SETUP.md` - Detailed role/authorization rules
- `docs/ENTRY-EXIT-SYSTEM.md` - Entry/Exit system specifics
- `docs/SYSTEM-ADMIN-INTERFACE.md` - System admin UI details
