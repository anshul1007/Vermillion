# VermillionIndia - Test User Credentials

## ✅ Login Issue FIXED!

The login functionality is now working. The backend API has been updated to return responses in the correct format expected by the frontend.

## Login Information

The database has been seeded with four test users with different roles:

### 1. Administrator
- **Email:** `admin@attendance.com`
- **Password:** `Admin@123`
- **Employee ID:** EMP001
- **Role:** Administrator
- **Access:** Full system access including user management, reports, and all features (except feature toggles)

### 2. Manager
- **Email:** `manager@attendance.com`
- **Password:** `Manager@123`
- **Employee ID:** EMP002
- **Role:** Manager
- **Access:** Can manage team attendance, approve leave requests, and view reports

### 3. Employee
- **Email:** `employee@attendance.com`
- **Password:** `Employee@123`
- **Employee ID:** EMP003
- **Role:** Employee
- **Manager:** Assigned to Manager (EMP002)
- **Access:** Can mark attendance, request leave, cancel pending leave requests, and view own records

### 4. System User
- **Email:** `system@attendance.com`
- **Password:** `System@123`
- **Employee ID:** SYS001
- **Role:** SystemUser
- **Access:** Exclusive control over feature toggles (cannot perform administrative tasks)

## API Endpoints

### Authentication Endpoint
- **POST** `/api/auth/login`
  - Request Body: `{ "email": "string", "password": "string" }`
  - Response: `{ "token": "string", "refreshToken": "string", "user": { ... } }`

- **GET** `/api/auth/me` (Requires authentication)
  - Returns current authenticated user details

## Application URLs

- **Frontend:** http://localhost:4200
- **Backend API:** http://localhost:5146
- **Swagger Documentation:** http://localhost:5146/swagger

## Quick Start

1. Open your browser and navigate to: http://localhost:4200
2. Click on "Login" or you'll be redirected to the login page
3. Use any of the credentials above to log in
4. You'll be redirected to the appropriate dashboard based on your role

## Notes

- All passwords use BCrypt hashing for security
- JWT tokens are used for authentication
- Token expiration: 60 minutes (configured in appsettings.json)
- CORS is enabled for frontend at http://localhost:4200

## What Was Fixed

The login issue was caused by a mismatch between the API response format:
- **Frontend expected:** `{ "success": true, "data": { ... }, "error": null }`
- **Backend was returning:** Direct data object

**Solution:** Created an `ApiResponse<T>` wrapper class that all API endpoints now use to return consistent response formats.

## Troubleshooting

If login still fails:
1. Make sure both backend (http://localhost:5146) and frontend (http://localhost:4200) are running
2. Check browser console (F12) for any CORS or network errors
3. Verify the backend is accessible: Open http://localhost:5146/swagger in your browser
4. Clear browser cache and localStorage if needed
5. Check that the database connection is working (backend logs will show any database errors)
