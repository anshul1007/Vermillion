# Entry/Exit Management System

## Overview
Complete entry/exit management system for construction sites with mobile app for security guards and web admin panel for site administrators.

## Architecture

### Backend API
- **Vermillion.API** (Port 5000): Unified API hosting all domain modules
  - **Auth Domain**: User authentication and JWT token management
  - **Attendance Domain**: Employee attendance tracking (separate system)
  - **EntryExit Domain**: Entry/exit records, labour/visitor management (routes: `/api/entryexit/*`, `/api/labour/*`, `/api/visitor/*`, `/api/records/*`)

### Frontend Applications
- **Web App (Angular 18+)**: Admin dashboard for managing projects, contractors, and guards
- **Mobile App (Ionic/Angular 18+)**: Guard interface for labour/visitor registration and entry/exit recording

## Features

### Web Admin Panel (`/entry-exit`)
- ✅ **Projects Management**: Create/edit/delete construction sites
- ✅ **Contractors Management**: Manage contractors and assign to projects
- ✅ **Security Guards Management**: Create guard profiles and assign to projects
- ✅ Professional gradient UI with card-based layout
- ✅ Form validation and error handling
- ✅ Real-time CRUD operations

**Access**: Available to users with **Administrator** role and `entryexit` tenant

### Mobile Guard App
- ✅ **Authentication**: JWT-based login for security guards
- ✅ **Guard Profile**: View assigned project and contractors
- ✅ **Labour Registration**:
  - Register workers with contractor selection (filtered by guard's project)
  - Capture photo and generate barcode
  - Name and phone number validation
- ✅ **Visitor Registration**:
  - Register visitors with company details and purpose
  - Auto-assign to guard's project
  - Photo capture
- ✅ **Entry/Exit Recording**:
  - Search by name/phone or barcode scan
  - View person details before entry/exit
  - Log entry/exit with timestamps
  - Visual status indicators
- ✅ **Dashboard**: Today's statistics and recent activity
- ✅ **Offline Support**: Local SQLite database with sync queue
- ✅ Professional gradient UI (#667eea to #764ba2)

## Database Schema

All EntryExit entities reside in the `entryexit` schema of `VermillionDB_Dev`.

### SecurityGuard
```csharp
- Id (PK)
- AuthUserId (FK to auth.Users)
- GuardId (unique identifier)
- FirstName, LastName
- PhoneNumber
- ProjectId (FK to Projects)
- IsActive
- CreatedAt, UpdatedAt
```

### Project
```csharp
- Id (PK)
- Name
- Description
- IsActive
- CreatedAt, UpdatedAt
```

### Contractor
```csharp
- Id (PK)
- Name
- ContactPerson
- PhoneNumber
- ProjectId (FK to Projects)
- IsActive
- CreatedAt, UpdatedAt
```

### LabourRegistration
```csharp
- Id (PK)
- ProjectId (FK to Projects)
- ContractorId (FK to Contractors)
- Name
- PhoneNumber
- Barcode (unique)
- PhotoPath
- CreatedBy, CreatedAt
```

### Visitor
```csharp
- Id (PK)
- Name
- PhoneNumber
- CompanyName
- Purpose
- PhotoPath
- CreatedBy, CreatedAt
```

### EntryExitRecord
```csharp
- Id (PK)
- LabourRegistrationId (FK, nullable)
- VisitorId (FK, nullable)
- Action (Entry/Exit)
- RecordedBy
- RecordedAt
- PhotoPath
```

## Test Users

### Security Guard
- **Username**: guard1
- **Password**: Guard@123
- **Role**: Guard
- **Tenant**: entryexit
- **Project**: Site A
- **Guard ID**: GRD001

### Administrator
- **Username**: admin
- **Password**: Admin@123
- **Role**: Admin
- **Tenant**: entryexit

## Setup Instructions

### 1. Database Setup
```bash
# Navigate to unified API project
cd backend/Vermillion.API

# Run migrations for EntryExit domain (if not already applied)
dotnet ef database update --context EntryExitDbContext

# Database will be automatically seeded with:
# - 3 Projects (Site A, Site B, Site C)
# - 4 Contractors (ABC Builders, XYZ Construction, etc.)
# - 1 Security Guard (linked to guard1 user)
```

### 2. Start Backend Service
```bash
# Start the unified Vermillion.API
cd backend/Vermillion.API
dotnet run

# API available at:
# - Main API: http://localhost:5000
# - Swagger UI: http://localhost:5000/swagger
# - Auth endpoints: http://localhost:5000/api/auth/*
# - EntryExit endpoints: http://localhost:5000/api/entryexit/*
```

### 3. Start Web App
```bash
cd frontend
npm install
ng serve

# Access at http://localhost:4200
# Login as admin / Admin@123
# Navigate to Entry/Exit menu
```

### 4. Start Mobile App
```bash
cd frontend-mobile
npm install
ionic serve

# Access at http://localhost:4300
# Login as guard1 / Guard@123
```

## API Endpoints

All endpoints are now served from the unified API at `http://localhost:5000`.

### EntryExit Domain - Admin Controller (`/api/entryexit/admin/*`)
- `POST /api/admin/projects` - Create project
- `GET /api/admin/projects` - Get all projects
- `PUT /api/admin/projects/{id}` - Update project
- `DELETE /api/admin/projects/{id}` - Delete project
- `POST /api/admin/contractors` - Create contractor
- `GET /api/admin/contractors` - Get all contractors
- `PUT /api/admin/contractors/{id}` - Update contractor
- `DELETE /api/admin/contractors/{id}` - Delete contractor
- `POST /api/admin/guards` - Create security guard
- `GET /api/admin/guards` - Get all guards
- `DELETE /api/admin/guards/{id}` - Delete guard
- `GET /api/admin/guards/profile` - Get guard profile (authenticated user)

### EntryExit Domain - Labour Controller (`/api/labour/*`)
- `POST /api/labour/register` - Register labour worker
- `GET /api/labour/search?name={name}&phone={phone}` - Search labour

### EntryExit Domain - Visitor Controller (`/api/visitor/*`)
- `POST /api/visitor/register` - Register visitor
- `GET /api/visitor/search?name={name}&phone={phone}` - Search visitor

### EntryExit Domain - Records Controller (`/api/records/*`)
- `POST /api/records` - Create entry/exit record
- `GET /api/records` - Get records with filters
- `GET /api/records/open-sessions` - Get currently on-site people
- `POST /api/records/search` - Advanced search

### EntryExit Domain - Sync Controller (`/api/entryexit/sync-batch`)
- `POST /api/entryexit/sync-batch` - Batch sync for mobile offline operations

## Mobile App Components

### 1. Login Component
- JWT authentication
- Role verification (must be Guard)
- Tenant verification (must have `entryexit` tenant)
- Error handling and loading states

### 2. Dashboard Component
- Guard info header (name, project, guard ID)
- Today's statistics cards
- Navigation menu to all features
- Profile link

### 3. Guard Profile Component
- Display guard details
- Show assigned project
- List contractors for the project

### 4. Labour Registration Component
- Contractor dropdown (filtered by guard's project)
- Name and phone input with validation
- Photo capture button
- Barcode generation
- Success/error messages
- Professional gradient UI
- Offline support with sync queue

### 5. Visitor Registration Component
- Visitor details form (name, phone, company, purpose)
- Photo capture
- Auto-assign to guard's project
- Form validation
- Success/error messages
- Offline support with sync queue

### 6. Entry/Exit Component
- Search bar (name/phone)
- Barcode scan button
- Display person details
- Entry/Exit action buttons
- Visual status indicators
- Guard project filtering
- Offline support with sync queue

### 7. Today Summary Component
- Active workers count
- Active visitors count
- Total entries today
- Recent activity list

### 8. Offline Sync
- Local SQLite database for offline storage
- Network status detection
- Operation queue for offline actions
- Automatic sync when connection restored
- Sync status indicators

## Web App Components

### Entry/Exit Dashboard Component
Located in: `frontend/src/app/features/entry-exit/dashboard/`

- **Tabs**: Projects | Contractors | Guards
- **Projects Tab**:
  - List all projects with status badges
  - Create/edit/delete projects
  - Form with name and description
- **Contractors Tab**:
  - List all contractors with project assignment
  - Create/edit/delete contractors
  - Form with name, contact person, phone, project
- **Guards Tab**:
  - List all guards with project assignment
  - Create guards (linked to auth user)
  - Delete guards
  - Form with first/last name, guard ID, phone, auth user ID, project

### Styling
- Professional gradient theme (#667eea to #764ba2)
- Card-based layouts
- Responsive design
- Form validation with visual feedback
- Success/error alerts
- Loading states
- Empty state messages

## Code Quality

### ✅ Completed Cleanup
- Removed all TODO comments
- Removed inline styles from HTML
- No FIXME or HACK comments
- No deprecated code
- Consistent coding patterns
- Proper TypeScript typing
- All compilation errors resolved

### Best Practices
- ✅ Standalone Angular components
- ✅ Signal-based state management
- ✅ Reactive forms with validation
- ✅ HTTP interceptor for JWT
- ✅ Route guards for authentication
- ✅ Service-based architecture
- ✅ Proper error handling
- ✅ Loading states for async operations

## Security

### Authentication
- JWT tokens with refresh mechanism
- Multi-tenant support (tenant domain required)
- Role-based access control (RBAC)
- Route guards on frontend
- Authorization attributes on backend controllers

### Data Protection
- Passwords hashed with BCrypt
- JWT tokens expire after configured time
- Refresh tokens for seamless re-authentication
- CORS configured for specific origins
- SQL injection prevention via Entity Framework
- Field-level encryption for sensitive data (Aadhar numbers)

## Future Enhancements

### Suggested Features
1. **Photo Storage**: Implement actual photo upload/storage (currently paths only)
2. **Barcode Implementation**: Real barcode scanning using ZXing library (already integrated in mobile)
3. **Reports & Analytics**:
   - Daily/weekly/monthly reports
   - Export to PDF/Excel
   - Charts and graphs
4. **Real-time Dashboard**:
   - WebSocket for live updates
   - Push notifications to guards
5. **Offline Support Enhancements**:
   - Conflict resolution for simultaneous edits
   - Background sync optimization
6. **Geolocation**: Track entry/exit location
7. **Contractor Dashboard**: Portal for contractors to view their workers
8. **Face Recognition**: AI-powered identity verification
9. **Attendance Integration**: Link with existing attendance system
10. **SMS Notifications**: Alert contractor when worker enters/exits

## Testing Checklist

### Backend Testing
- [ ] Login as guard1
- [ ] Get guard profile
- [ ] Create project via admin endpoint
- [ ] Create contractor and assign to project
- [ ] Create guard and assign to project
- [ ] Register labour worker
- [ ] Register visitor
- [ ] Create entry record
- [ ] Create exit record
- [ ] Search labour by name/phone/barcode
- [ ] Get open sessions
- [ ] Test batch sync endpoint with mobile operations

### Web App Testing
- [ ] Login as admin
- [ ] Navigate to Entry/Exit menu
- [ ] Create new project
- [ ] Edit project
- [ ] Create contractor and assign to project
- [ ] Edit contractor
- [ ] Create guard with auth user ID
- [ ] Verify guard appears in list
- [ ] Delete operations with confirmation

### Mobile App Testing
- [ ] Login as guard1
- [ ] View dashboard
- [ ] Navigate to guard profile
- [ ] Verify project and contractors display
- [ ] Navigate to labour registration
- [ ] Verify contractor dropdown filtered by project
- [ ] Fill form and test validation
- [ ] Navigate to visitor registration
- [ ] Fill visitor form and test validation
- [ ] Navigate to entry/exit
- [ ] Search for person
- [ ] Test entry action
- [ ] Test exit action
- [ ] Verify success messages
- [ ] Test offline mode (disable network)
- [ ] Verify operations queued
- [ ] Re-enable network and verify sync
- [ ] Test logout

## Troubleshooting

### Common Issues

**Issue**: Mobile app shows "Cannot connect to API"
- **Solution**: Ensure Vermillion.API is running on port 5000
- Check `frontend-mobile/src/environments/environment.ts` URLs (should be `http://localhost:5000`)

**Issue**: Login fails with "Invalid credentials"
- **Solution**: Verify test users exist in Auth domain database
- Check tenant domain is 'entryexit'
- Verify user has Guard role assigned

**Issue**: Guards dropdown empty in web admin
- **Solution**: Ensure Auth domain has users with Guard role
- Link guards using correct AuthUserId
- Verify guards are assigned to the correct tenant

**Issue**: Contractors not showing in mobile app
- **Solution**: Ensure contractors are assigned to guard's project
- Check guard profile has valid projectId

**Issue**: Entry/Exit record creation fails
- **Solution**: Verify person is registered (labour or visitor)
- Check guard has permission to access the endpoint
- Verify guard's project matches person's project

**Issue**: Offline sync not working
- **Solution**: Check SQLite database permissions
- Verify network status detection is working
- Check sync queue in local storage
- Review console logs for sync errors

**Issue**: 404 errors for API calls
- **Solution**: Verify API endpoints use correct port (5000, not 5001)
- Check environment.ts configuration
- Ensure Vermillion.API is running

## Technology Stack

### Backend
- .NET 8.0
- Entity Framework Core 8.0
- SQL Server LocalDB (dev) / Azure SQL (prod)
- JWT Bearer Authentication
- BCrypt for password hashing
- ASP.NET Data Protection (encryption)
- Swagger/OpenAPI

### Frontend Web
- Angular 18+ (standalone components)
- TypeScript 5.x
- RxJS 7.x
- Signals API
- SCSS
- Responsive design

### Frontend Mobile
- Angular 18+ (standalone components)
- Ionic Framework 8
- Capacitor 7 (for native features)
- Capacitor SQLite (offline storage)
- ZXing Browser (barcode scanning)
- Capacitor Camera (photo capture)
- Capacitor Network (network status)
- TypeScript 5.x
- RxJS 7.x
- Signals API

## Project Structure

```
Vermillion/
├── backend/
│   ├── Vermillion.API/           # Unified API host
│   │   ├── Controllers/
│   │   │   ├── LabourController.cs
│   │   │   ├── VisitorController.cs
│   │   │   ├── RecordsController.cs
│   │   │   ├── SyncController.cs
│   │   │   └── EntryExitAdminController.cs
│   │   ├── Extensions/
│   │   ├── Middleware/
│   │   ├── Program.cs
│   │   └── appsettings.json
│   └── Vermillion.EntryExit.Domain/  # EntryExit domain library
│       ├── Services/
│       │   ├── AdminService.cs
│       │   ├── LabourService.cs
│       │   ├── VisitorService.cs
│       │   ├── EntryExitRecordService.cs
│       │   ├── SyncService.cs
│       │   ├── PhotoStorageService.cs
│       │   ├── EncryptionService.cs
│       │   └── EntryExitSeeder.cs
│       ├── Models/
│       │   ├── Entities/
│       │   └── DTOs/
│       └── Data/
│           └── EntryExitDbContext.cs
├── frontend/
│   └── src/app/
│       ├── features/
│       │   └── entry-exit/
│       │       ├── dashboard/
│       │       │   ├── entry-exit-dashboard.component.ts
│       │       │   ├── entry-exit-dashboard.component.html
│       │       │   └── entry-exit-dashboard.component.scss
│       │       └── entry-exit.routes.ts
│       └── core/
│           └── services/
│               └── entry-exit.service.ts
└── frontend-mobile/
    └── src/app/
        ├── features/
        │   ├── login/
        │   ├── dashboard/
        │   ├── guard-profile/
        │   ├── labour-registration/
        │   ├── visitor-registration/
        │   ├── entry-exit/
        │   └── today-summary/
        └── core/
            ├── auth/
            │   ├── auth.service.ts
            │   ├── auth.guard.ts
            │   └── auth.interceptor.ts
            └── services/
                ├── api.service.ts
                ├── local-db.service.ts
                ├── sync.service.ts
                ├── barcode.service.ts
                └── photo.service.ts
```

## Support

For issues or questions:
1. Check this README
2. Review API documentation (Swagger at http://localhost:5000/swagger)
3. Check browser/terminal console for errors
4. Verify database seeding completed successfully
5. Review [CLAUDE.md](../CLAUDE.md) for complete project reference
