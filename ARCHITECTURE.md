# Vermillion Architecture & Refactoring Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Refactoring Summary](#refactoring-summary)
3. [Current Status](#current-status)
4. [Improvements & Next Steps](#improvements--next-steps)
5. [Quick Reference](#quick-reference)

---

## Architecture Overview

### Current Architecture: Modular Monolith

**Single unified API** (`Vermillion.API`) hosting **four domain modules** with **one database** using schema-based separation.

```
┌─────────────────────────────────────────────────────────────┐
│                    Vermillion.API (Port 5000)               │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐    │
│  │ Auth Domain   │  │ Attendance    │  │ EntryExit     │    │
│  │ /api/auth/*   │  │ /api/attend*  │  │ /api/entryex* │    │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘    │
│          │                  │                  │            │
│          └──────────────────┴──────────────────┘            │
│                              │                              │
│                  ┌───────────▼─────────────┐                │
│                  │  VermillionDB_Dev       │                │
│                  │  ┌─────┐ ┌─────┐ ┌────┐ │                │
│                  │  │auth │ │attn │ │ee  │ │                │
│                  │  │     │ │     │ │    │ │                │
│                  │  │     │ │     │ │    │ │                │
│                  │  └─────┘ └─────┘ └────┘ │                │
│                  │  ┌─────┐                │                │
│                  │  │share│                │                │
│                  │  │ d   │                │                │
│                  │  └─────┘                │                │
│                  └─────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
    1 API              1 Database            1 Deployment
```

### Domain Modules

#### 1. Auth Domain (`auth` schema)
**Purpose:** Centralized authentication, authorization, and user management

**Tables:**
- Tenants, Users, Roles, Permissions
- UserRoles, RolePermissions, RefreshTokens
- Departments, Employees

**Routes:** `/api/auth/*`, `/api/tenant/*`, `/api/users/*`

**Key Features:**
- JWT Bearer authentication with refresh tokens
- Multi-tenant support
- Role-based access control (RBAC)
- BCrypt password hashing
- SSO-ready for Zoho integration

---

#### 2. Attendance Domain (`attendance` schema)
**Purpose:** Employee attendance tracking and leave management

**Tables:**
- Attendance, LeaveRequests, LeaveEntitlements
- PublicHolidays

**Routes:** `/api/attendance/*`, `/api/leave/*`, `/api/approval/*`, `/api/admin/*`

**Key Features:**
- Clock in/out tracking
- Leave request and approval workflows
- Manager and HR dashboards
- Public holiday management
- Leave balance tracking

---

#### 3. EntryExit Domain (`entryexit` schema)
**Purpose:** Construction site entry/exit tracking with barcode scanning

**Tables:**
- Projects, Contractors, GuardProjectAssignments
- Labours, LabourRegistrations, Visitors
- EntryExitRecords

**Routes:** `/api/labour/*`, `/api/visitor/*`, `/api/records/*`, `/api/entryexit/*`

**Key Features:**
- Barcode-based labour registration
- Photo capture (mandatory)
- Offline sync for mobile guards
- Field-level encryption (Aadhar numbers)
- Project and contractor management

---

#### 4. Shared Domain (`shared` schema)
**Purpose:** Cross-cutting infrastructure for all domains

**Tables:**
- AuditLogs (audit trail for all domains)

**Key Features:**
- Centralized audit logging
- Shared infrastructure services

---

## Refactoring Summary

### What Was Accomplished

**Timeline:** November 2024
**Status:** ✅ **COMPLETE** - Build succeeds with 0 errors

### Migration Statistics
- **From:** 3 microservices → **To:** 1 monolith
- **From:** 3 databases → **To:** 1 database (4 schemas)
- **From:** 3 deployments → **To:** 1 deployment
- **Files migrated:** 96 C# files
- **Controllers migrated:** 13 controllers
- **Services migrated:** 22+ services
- **Namespace updates:** 68 files

### Before: Microservices Architecture

```
┌───────────────────────┐
│     Vermillion API    │
│  (Unified Monolithic) │
│  Port 5000            │
│                       │
│  VermillionDB_Dev     │
└───────────────────────┘
  1 API           1 Database           1 Deployment
```

**Issues:**
- ❌ High infrastructure cost (3 DBs, 3 connection pools)
- ❌ Network latency between services (50-100ms overhead)
- ❌ Complex debugging (distributed tracing needed)
- ❌ Deployment complexity (coordinate 3 deployments)
- ❌ Data duplication (Employee data in multiple DBs)

### Key Changes Made

#### 1. Project Structure Created
✅ `Vermillion.Auth.Domain` - Auth domain library
✅ `Vermillion.Attendance.Domain` - Attendance domain library
✅ `Vermillion.EntryExit.Domain` - EntryExit domain library
✅ `Vermillion.Shared.Domain` - Shared infrastructure library
✅ `Vermillion.API` - Unified web API project

#### 2. Database Schema Separation
✅ Single database (`VermillionDB_Dev`) with 4 schemas:
- `auth` - Authentication and user management
- `attendance` - Attendance and leave tracking
- `entryexit` - Construction site tracking
- `shared` - Audit logs and feature toggles

#### 3. Code Migration & Namespace Updates
✅ Converted 68 files:
- `AuthAPI.*` → `Vermillion.Auth.Domain.*`
- `AttendanceAPI.*` → `Vermillion.Attendance.Domain.*`
- `EntryExitAPI.*` → `Vermillion.EntryExit.Domain.*`

✅ Migrated 13 controllers to `Vermillion.API/Controllers/`
✅ Renamed conflicting AdminControllers:
- `AuthAdminController` (route: `/api/auth/admin`)
- `AttendanceAdminController` (route: `/api/admin`)
- `EntryExitAdminController` (route: `/api/entryexit/admin`)

#### 4. Unified Configuration
✅ Single `Program.cs` with:
- All 4 DbContext registrations (shared connection string)
- JWT authentication with role claim handling
- Service registration for all domains (30+ services)
- Memory cache for cross-domain caching
- CORS for web and mobile frontends
- Swagger documentation for unified API
- Automatic migration and seeding logic

#### 5. Dependency Updates
✅ Added required NuGet packages to domain libraries:
- Microsoft.EntityFrameworkCore (8.0.0)
- Microsoft.EntityFrameworkCore.SqlServer (8.0.0)
- Microsoft.Extensions.Logging.Abstractions (8.0.2)
- Microsoft.Extensions.Configuration.Abstractions (8.0.0)
- Microsoft.AspNetCore.Http.Abstractions (2.2.0)
- Microsoft.AspNetCore.DataProtection (8.0.0)
- Microsoft.AspNetCore.Hosting.Abstractions (2.2.0)

#### 6. Build Fixes
✅ Fixed 37 compilation errors:
- Added 22 missing `using` statements
- Resolved namespace conflicts (Attendance entity)
- Fixed missing interface registrations (IHttpContextAccessor, IEncryptionService, ILabourService)
- Added Data Protection services

---

## Current Status

### Build Status
✅ **Build succeeded** - 0 Errors, 8 Warnings (non-critical)

**Warnings:**
- CS8600: Nullable conversions (3 warnings)
- CS1998: Async methods without await (3 warnings)
- CS8601/CS8603: Null reference assignments (2 warnings)

### What's Working
✅ Solution compiles successfully
✅ All domain libraries build
✅ Unified API builds
✅ Database contexts configured correctly
✅ Dependency injection configured
✅ JWT authentication configured
✅ Swagger UI available

### File Structure
```
E:\Vermillion\
├── backend/
│   ├── Vermillion.API/               ← Unified API (ACTIVE)
│   │   ├── Controllers/              (13 controllers)
│   │   ├── Extensions/               (Service registrations)
│   │   ├── Middleware/
│   │   └── Program.cs
│   ├── Vermillion.Auth.Domain/       ← Auth domain library
│   ├── Vermillion.Attendance.Domain/ ← Attendance domain library
│   ├── Vermillion.EntryExit.Domain/  ← EntryExit domain library
│   └── Vermillion.Shared.Domain/     ← Shared infrastructure
├── frontend/                         (Angular web app)
├── frontend-mobile/                  (Capacitor mobile app)
├── docs/                             (Documentation)
├── ARCHITECTURE.md                   (This file)
└── Vermillion.sln                    (Solution file)
```

---

## Improvements & Next Steps

### 🔴 HIGH PRIORITY - Fix Immediately

#### 1. Replace HTTP Calls with Direct Method Calls ⭐ HIGHEST PRIORITY

**Problem:** Attendance and EntryExit domains still make HTTP calls to Auth endpoints internally, even though everything is in the same process.

**Current Flow:**
```
AttendanceController → AuthApiClient → HttpClient → Loopback HTTP → AuthController → AuthService
```

**Impact:**
- 50-100ms latency per call (HTTP overhead)
- ~1,000 lines of duplicate AuthApiClient code
- Complex caching with ConcurrentDictionary
- Network errors for in-process calls

**Solution:** Create `IUserService` interface in Auth domain with direct method calls.

**Steps:**
1. Create `IUserService` in `Vermillion.Auth.Domain/Services/`
2. Implement `UserService` class with direct DB queries
3. Register in DI: `services.AddScoped<IUserService, UserService>()`
4. Replace `AuthApiClient` in Attendance and EntryExit domains
5. Use `IMemoryCache` for caching instead of HTTP caching

**Expected Benefit:**
- ⚡ 100x faster (50-100ms → <1ms)
- 📉 Remove 1,000+ lines of code
- 🧹 Cleaner architecture
- 🐛 Better error handling

**Effort:** 4-6 hours | **ROI:** Extremely High

**Detailed Implementation Guide:** See `docs/IUSERSERVICE_IMPLEMENTATION.md`

---

#### 2. Add Unit Tests

**Problem:** Zero unit tests exist for any domain or service.

**Impact:**
- Cannot safely refactor code
- Bugs slip into production
- No documentation of expected behavior

**Solution:** Create test projects for each domain.

**Steps:**
1. Create test projects:
   - `Vermillion.Auth.Domain.Tests`
   - `Vermillion.Attendance.Domain.Tests`
   - `Vermillion.EntryExit.Domain.Tests`
2. Add NuGet packages: xUnit, Moq, FluentAssertions
3. Start with critical services (AuthService, JwtService)
4. Aim for 70%+ code coverage

**Effort:** 8-12 hours (initial setup) | **ROI:** High

---

#### 3. Simplify Program.cs

**Problem:** Program.cs is 365 lines with inline configuration logic.

**Status:** ✅ **PARTIALLY COMPLETE**
- Configuration extracted to extension methods in `Vermillion.API/Extensions/`
- `ServiceCollectionExtensions.cs` handles service registration
- `WebApplicationExtensions.cs` handles migration and seeding

**Remaining:**
- Consider splitting extension methods further if they grow
- Add XML documentation comments

**Effort:** Already done | **ROI:** Medium-High

---

### 🟡 MEDIUM PRIORITY - Fix Soon

#### 4. Add Global Exception Handling

**Problem:** Unhandled exceptions return 500 with stack traces to clients.

**Solution:** Add exception middleware for consistent error responses.

**Effort:** 1-2 hours | **ROI:** Medium

---

#### 5. Eliminate Code Duplication

**Problem:**
- `EmployeeDto`, `DepartmentDto` duplicated across Attendance and EntryExit
- `ApiResponse<T>` class duplicated
- Caching logic duplicated

**Solution:** Move shared DTOs to Shared domain library.

**Effort:** 1-2 hours | **ROI:** Medium

---

#### 6. Add Logging

**Problem:** Inconsistent logging across services.

**Solution:**
- Use ILogger consistently
- Add structured logging with Serilog
- Configure log levels per environment

**Effort:** 2-3 hours | **ROI:** Medium

---

### 🟢 LOW PRIORITY - Nice to Have

#### 7. Add Health Checks

**Problem:** No health check endpoints.

**Solution:** Add health checks for:
- Database connectivity
- Memory usage
- Disk space

**Effort:** 1-2 hours | **ROI:** Low-Medium

---

#### 8. Add API Versioning

**Problem:** No versioning strategy.

**Solution:** Implement URL-based versioning (`/api/v1/auth/*`).

**Effort:** 2-3 hours | **ROI:** Low

---

#### 9. Optimize Database Queries

**Problem:** Some N+1 query issues, missing indexes.

**Solution:**
- Add `.Include()` for related entities
- Create indexes for frequently queried columns
- Use `.AsNoTracking()` for read-only queries

**Effort:** 3-4 hours | **ROI:** Medium

---

## Quick Reference

### Essential Commands

**Build solution:**
```bash
dotnet build Vermillion.sln
```

**Start unified API:**
```bash
cd backend/Vermillion.API
dotnet run
```

**Create migrations:**
```bash
cd backend/Vermillion.API

# Auth domain
dotnet ef migrations add MigrationName --context AuthDbContext --output-dir Migrations/Auth

# Attendance domain
dotnet ef migrations add MigrationName --context AttendanceDbContext --output-dir Migrations/Attendance

# EntryExit domain
dotnet ef migrations add MigrationName --context EntryExitDbContext --output-dir Migrations/EntryExit

# Shared domain
dotnet ef migrations add MigrationName --context SharedDbContext --output-dir Migrations/Shared
```

**Apply migrations:**
```bash
# Automatic on startup (if RUN_MIGRATIONS=true)
dotnet run

# Or manually
dotnet ef database update --context AuthDbContext
dotnet ef database update --context AttendanceDbContext
dotnet ef database update --context EntryExitDbContext
dotnet ef database update --context SharedDbContext
```

**Run tests:**
```bash
dotnet test
```

### Key Endpoints

**Swagger UI:** http://localhost:5000/swagger

**Auth:**
- POST `/api/auth/login` - User login
- POST `/api/auth/refresh` - Refresh token
- GET `/api/users` - List users

**Attendance:**
- POST `/api/attendance/login` - Clock in
- POST `/api/attendance/logout` - Clock out
- GET `/api/attendance/today` - Today's attendance
- POST `/api/leave/request` - Create leave request

**EntryExit:**
- POST `/api/labour/register` - Register labour
- POST `/api/records/entry` - Log entry
- POST `/api/records/exit` - Log exit
- GET `/api/entryexit/admin/guards` - List guards

### Configuration Files

**Connection String:** `appsettings.json`
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\mssqllocaldb;Database=VermillionDB_Dev;..."
  }
}
```

**JWT Configuration:** `appsettings.json`
```json
{
  "Jwt": {
    "Key": "your-secret-key-here",
    "Issuer": "VermillionAPI",
    "Audience": "VermillionAPI",
    "AccessTokenExpirationMinutes": 60,
    "RefreshTokenExpirationDays": 7
  }
}
```

### Service Registration

**Location:** `backend/Vermillion.API/Extensions/ServiceCollectionExtensions.cs`

**Key methods:**
- `AddVermillionDatabase()` - Register all DbContexts
- `AddVermillionAuthentication()` - Configure JWT auth
- `AddVermillionDomainServices()` - Register domain services
- `AddVermillionCors()` - Configure CORS
- `AddVermillionSwagger()` - Configure Swagger

---

## Additional Documentation

**Detailed Implementation Guides:**
- `docs/IUSERSERVICE_IMPLEMENTATION.md` - Step-by-step guide for replacing HTTP calls
- `docs/DATABASE-MIGRATIONS.md` - Database migration guide
- `docs/CLAUDE_SETUP.md` - Development setup guide
- `docs/SYSTEM-ADMIN-INTERFACE.md` - Admin interface documentation
- `docs/ENTRY-EXIT-SYSTEM.md` - Entry/Exit system documentation

**Project Files:**
- `CLAUDE.md` - AI assistant context file
- `README.md` - Project overview and quick start

---

**Last Updated:** November 15, 2025
