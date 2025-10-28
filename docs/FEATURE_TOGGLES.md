# Feature Toggle Management Guide

## Overview

The Attendance System uses **Microsoft.FeatureManagement** for enterprise-grade feature toggle capabilities. This allows the **System User** to control feature availability without code deployments.

## System User Role

- **Email:** `system@attendance.com`
- **Password:** `System@123`
- **Role:** SystemUser
- **Access:** Exclusive control over feature toggles (Administrators cannot modify toggles)

## Available Feature Toggles

| Feature Key | Description | Default State |
|-------------|-------------|---------------|
| `AttendanceGeolocation` | Enable geolocation validation for attendance | Enabled |
| `LeaveAutoApproval` | Auto-approve leave requests below threshold | Disabled |
| `AdvancedAnalytics` | Enable advanced analytics and reporting | Enabled |
| `EmailNotifications` | Send email notifications for events | Disabled |
| `FacialRecognition` | Enable facial recognition for attendance | Disabled |
| `ClockOut` | Enable clock out / checkout functionality | Enabled |

## API Endpoints (SystemUser Only)

### Get All Feature Toggles
```http
GET /api/featuretoggle
Authorization: Bearer {system-user-token}
```

### Get Feature Toggle by ID
```http
GET /api/featuretoggle/{id}
Authorization: Bearer {system-user-token}
```

### Get Feature Toggle by Key
```http
GET /api/featuretoggle/key/{featureKey}
Authorization: Bearer {system-user-token}
```

### Check if Feature is Enabled (All Authenticated Users)
```http
GET /api/featuretoggle/check/{featureKey}
Authorization: Bearer {any-user-token}
```

**Response:**
```json
{
  "success": true,
  "data": true,
  "message": null,
  "errors": null
}
```

### Create Feature Toggle
```http
POST /api/featuretoggle
Authorization: Bearer {system-user-token}
Content-Type: application/json

{
  "featureKey": "NewFeature",
  "featureName": "New Feature Name",
  "description": "Feature description",
  "isEnabled": false
}
```

### Update Feature Toggle
```http
PUT /api/featuretoggle/{id}
Authorization: Bearer {system-user-token}
Content-Type: application/json

{
  "featureName": "Updated Feature Name",
  "description": "Updated description",
  "isEnabled": true
}
```

### Toggle Feature On/Off
```http
PATCH /api/featuretoggle/{id}/toggle
Authorization: Bearer {system-user-token}
Content-Type: application/json

{
  "isEnabled": true
}
```

### Delete Feature Toggle
```http
DELETE /api/featuretoggle/{id}
Authorization: Bearer {system-user-token}
```

## Using Feature Toggles in Code

### 1. Controller/Action Level (Using Attribute)

```csharp
using AttendanceAPI.Filters;

[HttpPost("checkin")]
[FeatureGate("AttendanceGeolocation")]
public async Task<IActionResult> CheckInWithGeolocation([FromBody] CheckInRequest request)
{
    // This endpoint only works if AttendanceGeolocation is enabled
    // Otherwise returns 403 Forbidden
}
```

### 2. Service Level (Using IFeatureManager)

```csharp
using Microsoft.FeatureManagement;

public class AttendanceService
{
    private readonly IFeatureManager _featureManager;

    public async Task CheckIn(CheckInRequest request)
    {
        if (await _featureManager.IsEnabledAsync("AttendanceGeolocation"))
        {
            // Validate geolocation
            ValidateGeolocation(request.Latitude, request.Longitude);
        }
        
        // Continue with check-in logic
    }
}
```

### 3. Using IFeatureToggleService

```csharp
public class LeaveService
{
    private readonly IFeatureToggleService _featureToggleService;

    public async Task ApproveLeave(Guid leaveRequestId)
    {
        if (await _featureToggleService.IsFeatureEnabledAsync("LeaveAutoApproval"))
        {
            // Auto-approve logic
        }
        else
        {
            // Manual approval workflow
        }
    }
}
```

## Benefits of Microsoft.FeatureManagement

1. **Standard Library**: Industry-standard Microsoft solution
2. **Performance**: Built-in caching and optimization
3. **Flexibility**: Support for time windows, percentage rollouts, and custom filters
4. **Database Backed**: Feature states stored in database, managed via API
5. **Real-time Changes**: No application restart needed for toggle changes
6. **Audit Trail**: Tracks who modified each feature and when

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   System User (API)                     │
│            POST/PUT/PATCH/DELETE Toggles                │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              FeatureToggleService                       │
│         (Manages FeatureToggle Table)                   │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│       DatabaseFeatureDefinitionProvider                 │
│  (IFeatureDefinitionProvider - reads from DB)           │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│           Microsoft.FeatureManagement                   │
│              IFeatureManager                            │
│         (Cached, High-Performance)                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│        Controllers & Services                           │
│     (Check features, apply business logic)              │
└─────────────────────────────────────────────────────────┘
```

## Database Schema

**FeatureToggles Table:**
```sql
CREATE TABLE FeatureToggles (
    Id uniqueidentifier PRIMARY KEY,
    FeatureKey nvarchar(100) NOT NULL UNIQUE,
    FeatureName nvarchar(200) NOT NULL,
    Description nvarchar(500),
    IsEnabled bit NOT NULL DEFAULT 0,
    CreatedAt datetime2 NOT NULL,
    UpdatedAt datetime2 NOT NULL,
    LastModifiedBy uniqueidentifier,
    FOREIGN KEY (LastModifiedBy) REFERENCES Users(Id)
)
```

## Security

- **SystemUser**: Full CRUD access to feature toggles
- **Administrator**: NO access to feature toggles
- **Manager/Employee**: Can only check if features are enabled (read-only via `/check` endpoint)

## Best Practices

1. **Naming Convention**: Use PascalCase for feature keys (e.g., `AttendanceGeolocation`)
2. **Descriptive Names**: Provide clear feature names and descriptions
3. **Default Off**: New features should default to disabled until tested
4. **Audit Trail**: Review `LastModifiedBy` and `UpdatedAt` regularly
5. **Documentation**: Document what each feature toggle controls
6. **Testing**: Test both enabled and disabled states

## Migration Notes

After creating the feature toggle table:

```bash
# Create migration
dotnet ef migrations add AddFeatureToggleSupport

# Apply migration
dotnet ef database update
```

The database will be automatically seeded with default feature toggles on first run.
