# Claude-style Setup & Rules (Vermillion)

Purpose
- Short reference to reproduce the authorization, tenant and UI access rules for Attendance & EntryExit flows.

Roles
- SystemAdmin
- Admin
- Manager
- Employee
- Guard

Modules
- Auth (Auth Domain in Vermillion.API)
- Attendance (Attendance Domain in Vermillion.API)
- EntryExit (EntryExit Domain in Vermillion.API)

Tenants
- attendance
- entryexit

Type of Flow
- Attendance (employee clock-in/out, leaves, approvals)
- EntryExit (labour/visitor registration, entry/exit records, guard mobile flows)

General Rules
1. SystemAdmin can perform any action any other role can perform (hierarchical role model).
2. Guard does NOT access the web Frontend; Guard uses mobile app only for labour/visitor check-in/out.
   - Mobile guard auth: frontend-mobile/src/app/core/auth/auth.guard.ts
   - Guard profile endpoint: backend/Vermillion.API/Controllers/EntryExitAdminController.cs `GET /api/admin/guards/profile`
   - Guards are explicitly filtered out from Attendance domain (see `GetUsers` in backend/Vermillion.API/Controllers/AttendanceAdminController.cs)
3. Employee Dashboard:
   - Accessible by Employee, Manager, Admin, SystemAdmin if they have the `attendance` tenant.
   - Hierarchical access: SystemAdmin > Admin > Manager > Employee
4. Manager Dashboard:
   - Accessible by Manager, Admin, SystemAdmin if they have the `attendance` tenant.
   - Manager can ONLY view their direct team members (enforced via `GetManagerTeamUserIdsAsync`).
   - Admin and SystemAdmin can view all teams.
5. Admin Dashboard (Attendance):
   - Accessible by Admin, SystemAdmin if they have the `attendance` tenant.
   - Full access to all attendance data across all users.
6. Entry/Exit Management Dashboard:
   - Accessible by Admin, SystemAdmin if they have the `entryexit` tenant.
   - Admin-only endpoints in backend/Vermillion.API/Controllers/EntryExitAdminController.cs
7. System Administration UI/API:
   - Accessible ONLY to SystemAdmin (no other role can access).
   - Backend controller: backend/Vermillion.API/Controllers/AuthAdminController.cs
   - SystemAdmin-only endpoints: roles CRUD, permissions CRUD, tenant management
   - Protection: `[Authorize(Roles = "SystemAdmin")]` attribute on sensitive endpoints

Key Backend Endpoints / Implementations

**Auth Domain - System Administration** (`backend/Vermillion.API/Controllers/AuthAdminController.cs`)
- Base authorization: `[Authorize(Roles = "Manager,Admin,SystemAdmin")]`
- User management: GET/POST/PUT/DELETE `/api/admin/users` - Admin,SystemAdmin only for mutations
- Role management: GET/POST/PUT/DELETE `/api/admin/roles` - **SystemAdmin-only** for mutations
- Permission management: GET/POST/PUT/DELETE `/api/admin/permissions` - **SystemAdmin-only** for mutations
- Tenant management: GET/PUT `/api/admin/tenants` - **SystemAdmin-only**
- User-Role-Tenant assignment: POST/DELETE `/api/admin/users/{userId}/tenants/{tenantId}/roles/{roleId}` - Admin,SystemAdmin
  - Special protection: Assigning/removing `systemadmin` role requires caller to be SystemAdmin
- Role-Permission mapping: POST/DELETE `/api/admin/roles/{roleId}/permissions/{permissionId}` - **SystemAdmin-only**

**Attendance Domain - Attendance & Team Management** (`backend/Vermillion.API/Controllers/AttendanceAdminController.cs`)
- Base authorization: `[Authorize]` (requires authentication)
- Users endpoint: GET `/api/admin/users` - Admin,SystemAdmin only
  - **Important**: Explicitly filters out Guard and SuperAdmin roles from attendance system
- Team members: GET `/api/admin/team-members` - Manager,Admin,SystemAdmin
  - Manager sees only their direct reports (enforced via `GetManagerTeamUserIdsAsync`)
  - Admin/SystemAdmin can view all users or specific manager's team
- Attendance history: GET `/api/admin/attendance/history` - Manager,Admin,SystemAdmin
  - Manager restricted to their team members only
  - Admin/SystemAdmin can view all attendance records
- Leave requests: GET `/api/admin/leave-requests` - Manager,Admin,SystemAdmin
  - Manager restricted to their team members only

**EntryExit Domain - Entry/Exit & Guard Management** (`backend/Vermillion.API/Controllers/EntryExitAdminController.cs`)
- Base authorization: `[Authorize(Roles = "SystemAdmin,Admin")]`
- Projects: POST/GET `/api/admin/projects` - Admin,SystemAdmin
- Contractors: POST/GET `/api/admin/contractors` - Admin,SystemAdmin
- Security Guards: POST/GET `/api/admin/guards` - Admin,SystemAdmin
- **Guard profile endpoint**: GET `/api/admin/guards/profile` - `[Authorize]` (any authenticated user)
  - Used by mobile app for guards to retrieve their profile
  - Matches guard by JWT's user ID claim

Key Frontend Files

**Web Application** (`frontend/`)
- Main navigation & role/tenant checks: `src/app/shared/components/navigation.component.ts`
  - Employee Dashboard link: Shows if user has Employee/Manager/Admin/SystemAdmin role AND `attendance` tenant
  - Team Management link: Shows if user has Manager/Admin/SystemAdmin role AND `attendance` tenant
  - Admin Panel link: Shows if user has Admin/SystemAdmin role AND `attendance` tenant
  - Entry/Exit Management link: Shows if user has Admin role (any level) AND `entryexit` tenant
  - System Admin link: Shows ONLY if user has SystemAdmin role
  - Helper methods: `hasRoleUser()`, `hasTenantUser()`, `hasTenantRoleUser()`
  - **Note**: Guard role is checked but Guards should never access web frontend
- System Admin dashboard UI: `src/app/features/system-admin/system-admin-dashboard.component.ts`
- SystemAdmin service: `src/app/core/services/system-admin.service.ts` (calls Vermillion.API auth domain endpoints)

**Mobile Application** (`frontend-mobile/`)
- Guard auth guard: `src/app/core/auth/auth.guard.ts`
  - `authGuard`: Basic authentication check (redirects to /login if not authenticated)
  - `guardRoleGuard`: Checks if user is authenticated AND has 'Guard' role
  - Used to protect mobile-only routes for guards

Quick Setup / Verification Steps
1. Start services:
   - Unified Vermillion.API (see repo README: `cd backend/Vermillion.API && dotnet run`).
   - Frontend web and mobile apps.
2. Seed/test users:
   - Create or use seeded users with roles: SystemAdmin, Admin, Manager, Employee, Guard.
   - Ensure SystemAdmin has access to both `attendance` and `entryexit` tenants (see seeding code).
3. Verify Auth rules:
   - Call protected SystemAdmin endpoints from backend/Vermillion.API/Controllers/AuthAdminController.cs using a SystemAdmin JWT → should succeed.
   - Attempt SystemAdmin-only endpoints with Admin/Manager token → should be rejected (403).
4. Verify Attendance flows:
   - Login as Employee/Manager/Admin with `attendance` tenant → access Employee/Manager/Admin dashboards.
   - Manager should only see their team (enforced in backend/Vermillion.API/Controllers/AttendanceAdminController.cs).
5. Verify Entry/Exit flows:
   - Admin with `entryexit` tenant → access Entry/Exit Admin UI and endpoints in backend/Vermillion.API/Controllers/EntryExitAdminController.cs.
   - Guard uses mobile app flows protected by frontend-mobile/src/app/core/auth/auth.guard.ts; verify the guard profile endpoint and mobile-only UI.
6. Navigation validation:
   - Ensure frontend navigation (frontend/src/app/shared/components/navigation.component.ts) shows/hides links based on the `currentUser` role and tenant checks.
7. Test edge cases:
   - Attempt to assign `systemadmin` role by non-SystemAdmin in backend/Vermillion.API/Controllers/AuthAdminController.cs (AssignUserToTenantRole) → should return Forbid.
   - Attempt Guard access to web UI → navigation and route guards should prevent this.

Acceptance Checklist
- [ ] SystemAdmin can manage users, roles, permissions, tenants (UI + API).
- [ ] Admin/Manager/Employee role mapping works per tenant.
- [ ] Guard only works via mobile; cannot see web admin links.
- [ ] Manager view is restricted to team members (enforced by `GetManagerTeamUserIdsAsync`).
- [ ] SystemAdmin-only endpoints return 403 for non-systemadmin callers.
- [x] Frontend navigation respects both role and tenant checks (navigation.component.ts).
- [ ] Guards are filtered out from Attendance domain user lists.
- [ ] Guard profile endpoint works for mobile app authentication.
- [ ] Manager cannot view another manager's team unless they are Admin/SystemAdmin.
- [ ] Assigning systemadmin role requires caller to be SystemAdmin.

Pointers (files & controllers)
- Auth domain controller for SystemAdmin & RBAC: backend/Vermillion.API/Controllers/AuthAdminController.cs
- Attendance admin & team logic: backend/Vermillion.API/Controllers/AttendanceAdminController.cs
- Entry/Exit admin endpoints and guard profile: backend/Vermillion.API/Controllers/EntryExitAdminController.cs
- Frontend navigation decisions: frontend/src/app/shared/components/navigation.component.ts
- System Admin dashboard UI: frontend/src/app/features/system-admin/system-admin-dashboard.component.ts
- SystemAdmin service (frontend): frontend/src/app/core/services/system-admin.service.ts
- Mobile auth guard (guard-only access): frontend-mobile/src/app/core/auth/auth.guard.ts

Notes
- The backend/Vermillion.API/Controllers/AuthAdminController.cs already enforces SystemAdmin restrictions for role/tenant assignments and role management.
- Attendance domain explicitly filters out Guard and SuperAdmin roles from the attendance system (see `GetUsers` endpoint in AttendanceAdminController.cs).
- Manager team scoping is enforced via `GetManagerTeamUserIdsAsync()` and `TeamManagementHelper` service in Attendance domain.
- Guard profile endpoint (`GET /api/admin/guards/profile`) uses `[Authorize]` to allow any authenticated user (guards authenticate via JWT).
- Frontend navigation uses hierarchical role checks: SystemAdmin > Admin > Manager > Employee.
- **Important naming**: Some code references "SuperAdmin" which should be standardized to "SystemAdmin" for consistency.
- **Architecture Note**: The system now uses a modular monolithic architecture with all domains in a single Vermillion.API project, maintaining domain boundaries through namespaces and database schemas.

Additional Enhancements (Optional)
- Add JWT examples and HTTPie/Postman snippets for each role to enable quick API testing.
- Create automated integration tests to validate role-based access control (RBAC) enforcement.
- Add route guards in frontend to prevent unauthorized access (currently relies on navigation hiding).
- Implement audit logging for SystemAdmin actions (user/role/permission/tenant changes).
- Consider adding a tenant switcher UI for users with multiple tenant assignments.

---

## Quick Reference Matrix

### Role & Dashboard Access

| Role | Employee Dashboard | Manager Dashboard | Admin Dashboard | Entry/Exit Mgmt | System Admin |
|------|-------------------|-------------------|-----------------|-----------------|--------------|
| **Employee** (attendance tenant) | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Manager** (attendance tenant) | ✅ | ✅ (team only) | ❌ | ❌ | ❌ |
| **Admin** (attendance tenant) | ✅ | ✅ (all users) | ✅ | ❌ | ❌ |
| **Admin** (entryexit tenant) | ❌ | ❌ | ❌ | ✅ | ❌ |
| **SystemAdmin** (any tenant) | ✅ | ✅ (all users) | ✅ | ✅ | ✅ |
| **Guard** (entryexit tenant) | ❌ | ❌ | ❌ | ❌ | ❌ |

**Note**: Guard uses mobile app only, not web frontend.

### API Endpoint Authorization

| Endpoint Category | Employee | Manager | Admin | SystemAdmin | Guard |
|------------------|----------|---------|-------|-------------|-------|
| **Auth Domain - User CRUD** | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Auth Domain - Role CRUD** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Auth Domain - Permission CRUD** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Auth Domain - Tenant Mgmt** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Attendance Domain - Team Members** | ❌ | ✅ (team) | ✅ (all) | ✅ (all) | ❌ |
| **Attendance Domain - Attendance History** | ❌ | ✅ (team) | ✅ (all) | ✅ (all) | ❌ |
| **EntryExit Domain - Projects/Contractors** | ❌ | ❌ | ✅ | ✅ | ❌ |
| **EntryExit Domain - Guard Profile** | ❌ | ❌ | ❌ | ❌ | ✅ |

### Key Protection Mechanisms

1. **SystemAdmin Role Assignment**: Only SystemAdmin can assign/remove systemadmin role
   - File: `backend/Vermillion.API/Controllers/AuthAdminController.cs`
   - Method: `AssignUserToTenantRole`, `RemoveUserFromTenantRole`
   - Check: `if (role.Name.Equals("systemadmin", ...) && !User.IsInRole("SystemAdmin")) return Forbid();`

2. **Manager Team Scoping**: Manager can only view their direct reports
   - File: `backend/Vermillion.API/Controllers/AttendanceAdminController.cs`
   - Service: `TeamManagementHelper` in `backend/Vermillion.Attendance.Domain/Services/`
   - Method: `GetManagerTeamUserIdsAsync()`
   - Usage: Filters all manager queries (team members, attendance, leave requests)

3. **Guard Filtering in Attendance**: Guards explicitly excluded from attendance system
   - File: `backend/Vermillion.API/Controllers/AttendanceAdminController.cs`
   - Method: `GetUsers`
   - Check: Skips users with role "Guard" or "SuperAdmin"

4. **Frontend Navigation**: Role and tenant-based link visibility
   - File: `frontend/src/app/shared/components/navigation.component.ts`
   - Methods: `hasRoleUser()`, `hasTenantUser()`, `hasTenantRoleUser()`
   - Hierarchical logic: SystemAdmin inherits all lower role capabilities

### Domain Service Locations

**Auth Domain** (`backend/Vermillion.Auth.Domain/Services/`)
- `JwtService.cs` - Token generation and validation
- `AuthService.cs` - Login, refresh, revocation logic
- `TenantService.cs` - Tenant management
- `UserService.cs` - User CRUD operations
- `IdentitySeeder.cs` - Database seeding for auth data

**Attendance Domain** (`backend/Vermillion.Attendance.Domain/Services/`)
- `TeamManagementHelper.cs` - Manager team scoping
- `CurrentUserService.cs` - JWT claims extraction

**EntryExit Domain** (`backend/Vermillion.EntryExit.Domain/Services/`)
- `AdminService.cs` - Projects, contractors, guards management
- `LabourService.cs` - Labour registration
- `VisitorService.cs` - Visitor registration
- `EntryExitRecordService.cs` - Entry/exit logging
- `SyncService.cs` - Offline sync for mobile
- `PhotoStorageService.cs` - Photo storage
- `EncryptionService.cs` - Field-level encryption
- `EntryExitSeeder.cs` - Database seeding for entry/exit data

**Shared Domain** (`backend/Vermillion.Shared.Domain/Services/`)
- `SharedSeeder.cs` - Audit logs and feature toggles seeding
- `DatabaseFeatureDefinitionProvider.cs` - Feature toggle provider
