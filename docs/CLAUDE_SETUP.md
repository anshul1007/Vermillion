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
- Auth (AuthAPI)
- Attendance (AttendanceAPI)
- EntryExit (EntryExitAPI)

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
   - Guard profile endpoint: backend/EntryExitAPI/Controllers/AdminController.cs `GET /api/admin/guards/profile`
   - Guards are explicitly filtered out from AttendanceAPI (see `GetUsers` in AttendanceAPI/Controllers/AdminController.cs)**
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
   - Admin-only endpoints in backend/EntryExitAPI/Controllers/AdminController.cs
7. System Administration UI/API:
   - Accessible ONLY to SystemAdmin (no other role can access).
   - Backend controller: backend/AuthAPI/Controllers/AdminController.cs
   - SystemAdmin-only endpoints: roles CRUD, permissions CRUD, tenant management
   - Protection: `[Authorize(Roles = "SystemAdmin")]` attribute on sensitive endpoints

Key Backend Endpoints / Implementations

**AuthAPI - System Administration** (`backend/AuthAPI/Controllers/AdminController.cs`)
- Base authorization: `[Authorize(Roles = "Manager,Admin,SystemAdmin")]`
- User management: GET/POST/PUT/DELETE `/api/admin/users` - Admin,SystemAdmin only for mutations
- Role management: GET/POST/PUT/DELETE `/api/admin/roles` - **SystemAdmin-only** for mutations
- Permission management: GET/POST/PUT/DELETE `/api/admin/permissions` - **SystemAdmin-only** for mutations
- Tenant management: GET/PUT `/api/admin/tenants` - **SystemAdmin-only**
- User-Role-Tenant assignment: POST/DELETE `/api/admin/users/{userId}/tenants/{tenantId}/roles/{roleId}` - Admin,SystemAdmin
  - Special protection: Assigning/removing `systemadmin` role requires caller to be SystemAdmin
- Role-Permission mapping: POST/DELETE `/api/admin/roles/{roleId}/permissions/{permissionId}` - **SystemAdmin-only**

**AttendanceAPI - Attendance & Team Management** (`backend/AttendanceAPI/Controllers/AdminController.cs`)
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

**EntryExitAPI - Entry/Exit & Guard Management** (`backend/EntryExitAPI/Controllers/AdminController.cs`)
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
- SystemAdmin service: `src/app/core/services/system-admin.service.ts` (calls AuthAPI admin endpoints)

**Mobile Application** (`frontend-mobile/`)
- Guard auth guard: `src/app/core/auth/auth.guard.ts`
  - `authGuard`: Basic authentication check (redirects to /login if not authenticated)
  - `guardRoleGuard`: Checks if user is authenticated AND has 'Guard' role
  - Used to protect mobile-only routes for guards

Quick Setup / Verification Steps
1. Start services:
   - AuthAPI, AttendanceAPI, EntryExitAPI and frontends (see repo README).
2. Seed/test users:
   - Create or use seeded users with roles: SystemAdmin, Admin, Manager, Employee, Guard.
   - Ensure SystemAdmin has access to both `attendance` and `entryexit` tenants (see seeding code).
3. Verify Auth rules:
   - Call protected SystemAdmin endpoints from backend/AuthAPI/Controllers/AdminController.cs using a SystemAdmin JWT  should succeed.
   - Attempt SystemAdmin-only endpoints with Admin/Manager token  should be rejected (403).
4. Verify Attendance flows:
   - Login as Employee/Manager/Admin with `attendance` tenant  access Employee/Manager/Admin dashboards.
   - Manager should only see their team (enforced in backend/AttendanceAPI/Controllers/AdminController.cs).
5. Verify Entry/Exit flows:
   - Admin with `entryexit` tenant  access Entry/Exit Admin UI and endpoints in backend/EntryExitAPI/Controllers/AdminController.cs.
   - Guard uses mobile app flows protected by frontend-mobile/src/app/core/auth/auth.guard.ts; verify the guard profile endpoint and mobile-only UI.
6. Navigation validation:
   - Ensure frontend navigation (frontend/src/app/shared/components/navigation.component.ts) shows/hides links based on the `currentUser` role and tenant checks.
7. Test edge cases:
   - Attempt to assign `systemadmin` role by non-SystemAdmin in backend/AuthAPI/Controllers/AdminController.cs (AssignUserToTenantRole)  should return Forbid.
   - Attempt Guard access to web UI  navigation and route guards should prevent this.

Acceptance Checklist
- [ ] SystemAdmin can manage users, roles, permissions, tenants (UI + API).
- [ ] Admin/Manager/Employee role mapping works per tenant.
- [ ] Guard only works via mobile; cannot see web admin links.
- [ ] Manager view is restricted to team members (enforced by `GetManagerTeamUserIdsAsync`).
- [ ] SystemAdmin-only endpoints return 403 for non-systemadmin callers.
- [ ] Frontend navigation respects both role and tenant checks (navigation.component.ts).
- [ ] Guards are filtered out from AttendanceAPI user lists.
- [ ] Guard profile endpoint works for mobile app authentication.
- [ ] Manager cannot view another manager's team unless they are Admin/SystemAdmin.
- [ ] Assigning systemadmin role requires caller to be SystemAdmin.

Pointers (files & controllers)
- Auth API controller for SystemAdmin & RBAC: backend/AuthAPI/Controllers/AdminController.cs
- Attendance admin & team logic: backend/AttendanceAPI/Controllers/AdminController.cs
- Entry/Exit admin endpoints and guard profile: backend/EntryExitAPI/Controllers/AdminController.cs
- Frontend navigation decisions: frontend/src/app/shared/components/navigation.component.ts
- System Admin dashboard UI: frontend/src/app/features/system-admin/system-admin-dashboard.component.ts
- SystemAdmin service (frontend): frontend/src/app/core/services/system-admin.service.ts
- Mobile auth guard (guard-only access): frontend-mobile/src/app/core/auth/auth.guard.ts

Notes
- The backend/AuthAPI/Controllers/AdminController.cs already enforces SystemAdmin restrictions for role/tenant assignments and role management.
- AttendanceAPI explicitly filters out Guard and SuperAdmin roles from the attendance system (see `GetUsers` endpoint).
- Manager team scoping is enforced via `GetManagerTeamUserIdsAsync()` and `ITeamManagementHelper` throughout AttendanceAPI.
- Guard profile endpoint (`GET /api/admin/guards/profile`) uses `[Authorize]` to allow any authenticated user (guards authenticate via JWT).
- Frontend navigation uses hierarchical role checks: SystemAdmin > Admin > Manager > Employee.
- **Important naming**: Some code references "SuperAdmin" which should be standardized to "SystemAdmin" for consistency.

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
| **AuthAPI - User CRUD** | ❌ | ❌ | ✅ | ✅ | ❌ |
| **AuthAPI - Role CRUD** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **AuthAPI - Permission CRUD** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **AuthAPI - Tenant Mgmt** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **AttendanceAPI - Team Members** | ❌ | ✅ (team) | ✅ (all) | ✅ (all) | ❌ |
| **AttendanceAPI - Attendance History** | ❌ | ✅ (team) | ✅ (all) | ✅ (all) | ❌ |
| **EntryExitAPI - Projects/Contractors** | ❌ | ❌ | ✅ | ✅ | ❌ |
| **EntryExitAPI - Guard Profile** | ❌ | ❌ | ❌ | ❌ | ✅ |

### Key Protection Mechanisms

1. **SystemAdmin Role Assignment**: Only SystemAdmin can assign/remove systemadmin role
   - File: `backend/AuthAPI/Controllers/AdminController.cs`
   - Method: `AssignUserToTenantRole`, `RemoveUserFromTenantRole`
   - Check: `if (role.Name.Equals("systemadmin", ...) && !User.IsInRole("SystemAdmin")) return Forbid();`

2. **Manager Team Scoping**: Manager can only view their direct reports
   - File: `backend/AttendanceAPI/Controllers/AdminController.cs`
   - Method: `GetManagerTeamUserIdsAsync()`
   - Usage: Filters all manager queries (team members, attendance, leave requests)

3. **Guard Filtering in Attendance**: Guards explicitly excluded from attendance system
   - File: `backend/AttendanceAPI/Controllers/AdminController.cs`
   - Method: `GetUsers`
   - Check: Skips users with role "Guard" or "SuperAdmin"

4. **Frontend Navigation**: Role and tenant-based link visibility
   - File: `frontend/src/app/shared/components/navigation.component.ts`
   - Methods: `hasRoleUser()`, `hasTenantUser()`, `hasTenantRoleUser()`
   - Hierarchical logic: SystemAdmin inherits all lower role capabilities
