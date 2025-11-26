# System Administrator Interface

## Overview
Comprehensive system administration interface for managing users, roles, permissions, and tenants in the Vermillion multi-tenant platform.

## Features

### 🔐 Access Control
- **Restricted to SystemAdmin Role**: Only users with `SystemAdmin` role can access these features
- **JWT-based Authentication**: All API endpoints require valid JWT token with SystemAdmin role claim

### 👥 User Management
- View all users across all tenants
- Create new users with email and password
- Update user details (username, email, password)
- Delete users (with validation)
- Assign users to multiple tenants with different roles
- Manage user access (activate/deactivate per tenant)

### 🎭 Role Management
- View all roles with assigned permissions
- Create custom roles
- Edit role names and descriptions
- Delete roles (if not assigned to users)
- Activate/Deactivate roles
- Manage role permissions (assign/remove)

### 🔑 Permission Management
- View all system permissions
- Create new permissions with resource and action
- Edit permission details
- Delete permissions (if not assigned to roles)
- Permission naming convention: `resource.action` (e.g., `user.create`, `attendance.view`)

### 🏢 Tenant Management
- View all tenants with user counts
- Edit tenant names and domains
- View tenant API keys (masked with copy function)
- Monitor tenant status (active/inactive)

## Architecture

### Backend API (Vermillion.API)

#### AuthAdminController (Auth Domain)
**Base URL**: `http://localhost:5000/api/admin`

**Location**: `backend/Vermillion.API/Controllers/AuthAdminController.cs`

**Authentication**: Bearer token with `SystemAdmin` role required for all endpoints

##### User Endpoints
```
GET    /users                              # Get all users (optional tenantId filter)
GET    /users/{id}                         # Get user by ID with full details
POST   /users                              # Create new user
PUT    /users/{id}                         # Update user
DELETE /users/{id}                         # Delete user
POST   /users/{userId}/tenants/{tenantId}/roles/{roleId}  # Assign user to tenant role
DELETE /users/{userId}/tenants/{tenantId}/roles/{roleId}  # Remove user from tenant role
PUT    /user-roles/{id}/activate           # Activate user role
PUT    /user-roles/{id}/deactivate         # Deactivate user role
```

##### Role Endpoints
```
GET    /roles                              # Get all roles with permissions
GET    /roles/{id}                         # Get role by ID
POST   /roles                              # Create new role
PUT    /roles/{id}                         # Update role
DELETE /roles/{id}                         # Delete role
PUT    /roles/{id}/activate                # Activate role
PUT    /roles/{id}/deactivate              # Deactivate role
POST   /roles/{roleId}/permissions/{permissionId}     # Assign permission to role
DELETE /roles/{roleId}/permissions/{permissionId}     # Remove permission from role
```

##### Permission Endpoints
```
GET    /permissions                        # Get all permissions
POST   /permissions                        # Create new permission
PUT    /permissions/{id}                   # Update permission
DELETE /permissions/{id}                   # Delete permission
```

##### Tenant Endpoints
```
GET    /tenants                            # Get all tenants
PUT    /tenants/{id}                       # Update tenant
```

### Frontend (Angular 18)

#### Routes
- `/system-admin` - Dashboard with navigation cards
- `/system-admin/users` - User management interface
- `/system-admin/roles` - Role management interface
- `/system-admin/permissions` - Permission management interface
- `/system-admin/tenants` - Tenant management interface

#### Services
**SystemAdminService** (`frontend/src/app/core/services/system-admin.service.ts`)
- Provides typed methods for all SystemAdmin API operations
- Uses RxJS Observables
- Automatic error handling and data transformation

## Usage

### Accessing System Admin Panel

1. **Login as SystemAdmin**:
   ```
   Email: admin@vermillion.com
   Password: Admin@123
   ```

2. **Navigate to System Admin**:
   - Click the "🔧 System Admin" link in the navigation bar (visible only to SystemAdmin users)

### Creating a New User

1. Go to **Users Management**
2. Click **+ Create User**
3. Fill in the form:
   - Username (required)
   - Email (required)
   - Password (required)
   - External Provider (optional)
4. Click **Create**
5. Assign tenant access by clicking **🔑** (Manage Access)

### Creating a New Role

1. Go to **Roles Management**
2. Click **+ Create Role**
3. Enter:
   - Role Name (e.g., "AccountManager")
   - Description (optional)
4. Click **Create**
5. Click **View Permissions** to assign permissions

### Managing Permissions

1. Go to **Permissions Management**
2. Click **+ Create Permission**
3. Enter:
   - Permission Name: `resource.action` (e.g., `invoice.create`)
   - Resource: The entity/feature (e.g., `invoice`)
   - Action: The operation (e.g., `create`, `view`, `update`, `delete`)
   - Description (optional)
4. Click **Create**

### Assigning User to Tenant with Role

1. Go to **Users Management**
2. Find the user and click **🔑** (Manage Access)
3. In the "Add New Access" section:
   - Select Tenant
   - Select Role
4. Click **Add Access**

## Data Models

### SystemUser
```typescript
interface SystemUser {
  id: number;
  username: string;
  email: string;
  externalProvider?: string;
  createdAt: Date;
  tenants: Array<{
    tenantId: number;
    tenantName: string;
    tenantDomain: string;
    roleId: number;
    roleName: string;
    isActive: boolean;
  }>;
}
```

### Role
```typescript
interface Role {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  permissionCount?: number;
  permissions?: Permission[];
}
```

### Permission
```typescript
interface Permission {
  id: number;
  name: string;
  resource: string;
  action: string;
  description?: string;
  isActive?: boolean;
}
```

### Tenant
```typescript
interface Tenant {
  id: number;
  name: string;
  domain: string;
  isActive: boolean;
  createdAt: Date;
  userCount?: number;
}
```

## Security Considerations

### Authorization
- All SystemAdmin endpoints require `[Authorize(Roles = "SystemAdmin")]`
- JWT tokens must contain SystemAdmin role claim
- Frontend routes protected by `roleGuard` with `SystemAdmin` requirement

### Data Validation
- Email uniqueness checked on user creation/update
- Role names must be unique
- Permission names must be unique
- Tenant domains must be unique
- Cannot delete roles/permissions that are in use

### Password Handling
- Passwords hashed using BCrypt
- Minimum password requirements enforced
- Password never returned in API responses

## UI/UX Features

### Modern Design
- Gradient backgrounds and cards
- Smooth transitions and hover effects
- Responsive grid layouts
- Mobile-friendly interface

### User Feedback
- Loading states for all operations
- Error messages with detailed information
- Confirmation dialogs for destructive actions
- Success notifications

### Data Visualization
- Color-coded status badges (Active/Inactive)
- Permission and role counts
- User tenant assignments displayed inline
- API key masking with copy function

## Testing

### Test Users
```
SystemAdmin:
  Email: admin@vermillion.com
  Password: Admin@123
  Access: Both 'attendance' and 'entryexit' tenants
```

### API Testing
Use the provided test credentials to:
1. Login via `/api/auth/login`
2. Use returned JWT token in Authorization header: `Bearer <token>`
3. Test SystemAdmin endpoints

### Frontend Testing
1. Login as SystemAdmin user
2. Access `/system-admin` route
3. Test all CRUD operations across management interfaces

## Future Enhancements

### Planned Features
- [ ] Bulk user import/export (CSV)
- [ ] Audit logging for all admin actions
- [ ] Role templates (pre-configured permission sets)
- [ ] Advanced user search and filtering
- [ ] User impersonation for debugging
- [ ] Permission dependency management
- [ ] Multi-tenant registration wizard
- [ ] API key regeneration for tenants

### Performance Improvements
- [ ] Pagination for large user lists
- [ ] Server-side filtering and sorting
- [ ] Caching for frequently accessed data
- [ ] Lazy loading for permission lists

## Troubleshooting

### Common Issues

**Issue**: Cannot access System Admin panel
- **Solution**: Ensure user has `SystemAdmin` role in at least one tenant
- Verify JWT token contains correct role claim

**Issue**: "Failed to load users" error
- **Solution**: Check AuthAPI is running on port 5275
- Verify database connection string
- Check browser console for CORS errors

**Issue**: Cannot delete role/permission
- **Solution**: Check if role is assigned to users or permission is assigned to roles
- Remove all dependencies before deletion

**Issue**: User role assignment not working
- **Solution**: Verify tenant and role IDs are valid
- Check user doesn't already have that role in the tenant

## Development

### Adding New Permissions
1. Create permission via UI or seed in `IdentitySeeder.cs`
2. Assign to appropriate roles
3. Use in backend controllers: `[Authorize(Policy = "resource.action")]`

### Adding New Resources
1. Define permissions for new resource
2. Create permissions in database
3. Assign to relevant roles
4. Implement authorization in controllers

## File Structure

```
backend/AuthAPI/
├── Controllers/
│   └── SystemAdminController.cs       # Main SystemAdmin API controller
├── Models/
│   └── DTOs/
│       └── SystemAdminDtos.cs         # Request/Response DTOs
└── Program.cs                          # JWT configuration added

frontend/src/app/
├── core/
│   └── services/
│       └── system-admin.service.ts    # SystemAdmin API service
├── features/
│   └── system-admin/
│       ├── system-admin-dashboard.component.ts
│       ├── system-admin.routes.ts
│       ├── users/
│       │   └── users-management.component.ts
│       ├── roles/
│       │   └── roles-management.component.ts
│       ├── permissions/
│       │   └── permissions-management.component.ts
│       └── tenants/
│           └── tenants-management.component.ts
└── app.routes.ts                       # Added system-admin route
```

## API Response Format

All API responses follow this format:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

Error responses:
```json
{
  "success": false,
  "data": null,
  "message": "Error description"
}
```

## Conclusion

The System Administrator interface provides a comprehensive, secure, and user-friendly way to manage the entire Vermillion platform. With full CRUD operations for users, roles, permissions, and tenants, administrators have complete control over the multi-tenant architecture.
