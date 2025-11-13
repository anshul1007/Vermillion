# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vermillion is an enterprise-grade microservices platform with three main APIs (AuthAPI, AttendanceAPI, EntryExitAPI) and two frontends (web Angular app, mobile Capacitor app). The system provides centralized authentication with multi-tenant support for attendance management and construction site entry/exit tracking.

**Tech Stack:**
- Backend: .NET 8 Web API, Entity Framework Core 8, SQL Server
- Frontend: Angular 20+ (standalone components), Capacitor 7 (mobile)
- Authentication: JWT Bearer tokens with refresh token support
- Database: SQL Server LocalDB (dev), Azure SQL (production)

## Essential Commands

### Backend Development

**Start all services (PowerShell):**
```powershell
.\start-all.ps1
```

**Individual API startup:**
```bash
# AuthAPI (port 5275)
cd backend/AuthAPI
dotnet run

# AttendanceAPI (port 5000)
cd backend/AttendanceAPI
dotnet run

# EntryExitAPI (port 5001)
cd backend/EntryExitAPI
dotnet run
```

**Database migrations:**
```bash
# Create migration
cd backend/[AuthAPI|AttendanceAPI|EntryExitAPI]
dotnet ef migrations add MigrationName

# Apply migration
dotnet ef database update

# Rollback migration
dotnet ef database update PreviousMigrationName
```

**Build and test:**
```bash
# Build solution
dotnet build Vermillion.sln

# Build specific project
dotnet build backend/AuthAPI/AttendanceAPI.csproj

# Run tests (if available)
dotnet test
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

### Microservices Communication

1. **AuthAPI** (Port 5275) - Central authentication service
   - Issues JWT tokens (60 min access, 7 day refresh)
   - Manages tenants, users, roles, permissions
   - Multi-tenant architecture with tenant domains: `attendance`, `entryexit`
   - Database: `AuthDB_Dev`

2. **AttendanceAPI** (Port 5000) - Employee attendance tracking
   - Validates JWT from AuthAPI
   - Clock in/out, leave management, approvals
   - Role-based access: SystemAdmin > Admin > Manager > Employee
   - Database: `AttendanceDB_Dev`

3. **EntryExitAPI** (Port 5001) - Construction site worker/visitor tracking
   - Validates JWT from AuthAPI
   - Labour/visitor registration with barcode scanning
   - Entry/exit logging with photo capture
   - Offline sync support for mobile app
   - Field-level encryption for sensitive data (Aadhar numbers)
   - Database: `EntryExitDB_Dev`

### Authentication Flow

All microservices share the same JWT validation configuration:
- **Issuer/Audience**: Configured in `appsettings.json` under `Jwt:Issuer` and `Jwt:Audience`
- **Secret Key**: Shared JWT secret in `Jwt:Key` (same across all APIs)
- **Token Claims**: `sub` (userId), `email`, `tenants` (JSON array with roles), `role:{domain}`, standard `ClaimTypes.Role`

**Token lifecycle:**
1. User logs in → AuthAPI validates credentials → Returns access + refresh tokens
2. Client includes token in `Authorization: Bearer {token}` header
3. API validates JWT → Extracts user/role/tenant claims → Processes request
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
- Enforced via `GetManagerTeamUserIdsAsync` in AttendanceAPI
- Can approve leave requests for team members

**Employee**
- Access to their own attendance data
- Can clock in/out, submit leave requests

**Guard**
- Mobile-only role for EntryExitAPI
- Does NOT access web frontend
- Can perform labour/visitor check-in/out operations
- Explicitly filtered out from AttendanceAPI user lists

### Frontend Architecture

**Web App (frontend/)** - Standalone Angular components
- Structure: `app/core/` (auth, interceptors, services), `app/features/` (role-based dashboards), `app/shared/` (components)
- Features: `admin/`, `employee/`, `manager/`, `system/`, `system-admin/`
- Authentication: JWT interceptor adds token to requests, auth guard protects routes
- Services call AttendanceAPI and AuthAPI

**Mobile App (frontend-mobile/)** - Capacitor-based Ionic Angular
- Structure: `app/core/` (auth, services), `app/features/` (registration, entry/exit, dashboard)
- Key capabilities:
  - Offline-first with SQLite (`@capacitor-community/sqlite`)
  - Camera barcode scanning (`@zxing/browser`)
  - Photo capture (`@capacitor/camera`)
  - Network status detection (`@capacitor/network`)
  - Sync queue for offline operations (syncs when online)
- Services: `api.service.ts`, `local-db.service.ts`, `sync.service.ts`, `barcode.service.ts`, `photo.service.ts`
- Calls EntryExitAPI and AuthAPI

### Database Migrations

**IMPORTANT:** Migrations are disabled by default in production (controlled by `RUN_MIGRATIONS` env var or `RunMigrations` config).

**Production migrations:**
- Use GitHub Actions workflow: `.github/workflows/run-migrations.yml`
- Manual trigger with environment selection (prod/dev/staging)
- Can run seeders separately from migrations
- Can target specific backends or all

**Development:**
- Migrations run automatically on startup in Development environment
- Each API has its own `Migrations/` folder
- Use standard EF Core migration commands

### Key Service Implementations

**AuthAPI Services:**
- `JwtService`: Token generation with tenant/role claims
- `AuthService`: Login, token refresh, revocation
- `TenantService`: Multi-tenant management
- `IdentitySeeder`: Seeds default admin users and tenants

**AttendanceAPI Services:**
- `AuthApiClient`: Cached HTTP client for AuthAPI user data
- `CachedAuthApiClient`: Memory cache wrapper (5 min cache)
- `TeamManagementHelper`: Manager team member filtering
- `CurrentUserService`: Extracts current user from JWT claims
- `DatabaseFeatureDefinitionProvider`: Feature toggles from database

**EntryExitAPI Services:**
- `AdminService`: Projects, contractors, guards management
- `LabourService`: Labour registration with barcode generation
- `VisitorService`: Visitor registration
- `EntryExitRecordService`: Entry/exit logging with double-entry prevention
- `SyncService`: Batch sync endpoint for mobile offline operations
- `PhotoStorageService`: Photo storage to `wwwroot/photos`
- `EncryptionService`: Field-level encryption using ASP.NET Data Protection
- `AuthApiClient` + `CachedAuthApiClient`: User data from AuthAPI

### Important Patterns

**Tenant Filtering:**
- Controllers extract tenant from JWT: `User.FindFirst("tenantDomain")?.Value`
- Queries filter by `TenantId` or verify tenant domain matches
- Cross-tenant access is prevented at API level

**Role-Based Authorization:**
- Use `[Authorize(Roles = "SystemAdmin")]` for SystemAdmin-only endpoints
- Use `[Authorize(Roles = "Admin,SystemAdmin")]` for admin operations
- Manager-level checks use service layer filtering (e.g., `GetManagerTeamUserIdsAsync`)
- Guards role explicitly excluded from AttendanceAPI

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

## Common Development Workflows

### Adding a New Migration

1. Make model changes in `Models/Entities/`
2. Update `DbContext` if needed
3. Create migration: `dotnet ef migrations add YourMigrationName`
4. Review generated migration in `Migrations/` folder
5. Apply locally: `dotnet ef database update`
6. Test thoroughly before committing

### Adding a New API Endpoint

1. Create/update DTO in `Models/DTOs/`
2. Add endpoint to appropriate controller in `Controllers/`
3. Add `[Authorize(Roles = "...")]` attribute for role-based access
4. Implement business logic in `Services/` if complex
5. Test with `.http` files (e.g., `AuthAPI.http`)

### Adding a New Frontend Feature

1. Create feature component in `app/features/[feature-name]/`
2. Add route in `app.routes.ts` with auth guard
3. Create service in `app/core/services/` for API calls
4. Use dependency injection: `private api = inject(ApiService)`
5. Handle authentication errors (401/403) to redirect to login

### Debugging JWT Issues

- Check `Jwt:Key` is identical across all APIs
- Check `Jwt:Issuer` and `Jwt:Audience` match in `appsettings.json`
- Enable JWT logging: APIs have `OnAuthenticationFailed` and `OnTokenValidated` event handlers
- Verify role claims are present: check `role:{domain}` or `ClaimTypes.Role`
- Decode token at jwt.io to inspect claims

## Configuration Files

**Backend appsettings structure:**
- `appsettings.json` - Base configuration (Logging, AllowedHosts, Cors)
- `appsettings.Development.json` - LocalDB connection strings, dev settings
- `appsettings.Production.json` - Azure SQL connection strings, prod settings

**Key configuration sections:**
- `ConnectionStrings:DefaultConnection` - Database connection
- `Jwt:Key`, `Jwt:Issuer`, `Jwt:Audience` - JWT configuration (must match across all APIs)
- `AuthApiUrl` - URL for AuthAPI (used by Attendance/EntryExit to fetch user data)
- `SeedOnStartup` - Controls whether seeders run on startup
- `RUN_MIGRATIONS` - Controls whether migrations run on startup (false in prod)

**Frontend environment files:**
- `frontend/src/environments/environment.ts` - Dev API URLs
- `frontend/src/environments/environment.prod.ts` - Production API URLs
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

## Related Documentation

- `README.md` - Quick start guide and architecture overview
- `docs/DATABASE-MIGRATIONS.md` - Migration and seeder management
- `docs/CLAUDE_SETUP.md` - Detailed role/authorization rules
- `docs/ENTRY-EXIT-SYSTEM.md` - Entry/Exit system specifics
- `docs/SYSTEM-ADMIN-INTERFACE.md` - System admin UI details
