# System User Quick Reference

## Login Credentials
```
Email: system@attendance.com
Password: System@123
```

## Your Role
You are the **SystemUser** - responsible for managing feature toggles across the application. You **cannot** perform administrative tasks like user management.

## Quick API Reference

### Authentication
```bash
# Login to get your token
POST http://localhost:5146/api/auth/login
Content-Type: application/json

{
  "email": "system@attendance.com",
  "password": "System@123"
}
```

### List All Features
```bash
GET http://localhost:5146/api/featuretoggle
Authorization: Bearer YOUR_TOKEN
```

### Enable a Feature
```bash
PATCH http://localhost:5146/api/featuretoggle/{feature-id}/toggle
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "isEnabled": true
}
```

### Disable a Feature
```bash
PATCH http://localhost:5146/api/featuretoggle/{feature-id}/toggle
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "isEnabled": false
}
```

### Check Feature Status
```bash
GET http://localhost:5146/api/featuretoggle/check/AttendanceGeolocation
Authorization: Bearer YOUR_TOKEN
```

### Create New Feature
```bash
POST http://localhost:5146/api/featuretoggle
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "featureKey": "NewFeatureName",
  "featureName": "Human Readable Name",
  "description": "What this feature does",
  "isEnabled": false
}
```

## Current Features You Control

| Feature | Key | Impact |
|---------|-----|--------|
| 📍 Geolocation | `AttendanceGeolocation` | Requires location for check-in |
| ✅ Auto-Approve | `LeaveAutoApproval` | Auto-approves leave requests |
| 📊 Analytics | `AdvancedAnalytics` | Shows advanced reports |
| 📧 Emails | `EmailNotifications` | Sends email alerts |
| 🎭 Face ID | `FacialRecognition` | Uses facial recognition |
| ⏲️ Clock Out | `ClockOut` | Enables clock out / checkout functionality |

## Best Practices

1. **Test First**: Toggle features in dev/test environment first
2. **Monitor Impact**: Check logs after enabling critical features
3. **Document Changes**: Keep notes on why you enabled/disabled features
4. **Gradual Rollout**: Enable one feature at a time
5. **Communicate**: Inform stakeholders before major toggle changes

## What You CANNOT Do

❌ Create/modify users  
❌ Manage departments  
❌ Access admin reports  
❌ Modify leave policies  
❌ Change user roles  

## What You CAN Do

✅ Enable/disable any feature  
✅ Create new feature toggles  
✅ View all feature states  
✅ Check your own attendance  
✅ Request leave (as an employee)  

## Support

If you need to perform administrative tasks, contact an Administrator:
- **Email:** admin@attendance.com
- **Password:** Admin@123
