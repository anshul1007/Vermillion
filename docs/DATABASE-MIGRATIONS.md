# Database Migrations and Seeders CI/CD

This document explains how to manage database migrations and seeders separately from application deployments.

## Overview

Starting from November 2024, database migrations are **disabled by default in production** deployments. This prevents application startup failures due to intermittent database connectivity issues and provides better control over when schema changes are applied.

## Architecture

- **Backend Deployment** (`deploy-backend.yml`): Deploys application code with `RUN_MIGRATIONS=false` in production
- **Migrations Workflow** (`run-migrations.yml`): Runs EF Core migrations and seeders on-demand
- **Application Startup**: APIs check `RUN_MIGRATIONS` environment variable or `RunMigrations` config

## Running Migrations

### Via GitHub Actions (Recommended)

1. Go to **Actions** → **Run Database Migrations and Seeders**
2. Click **Run workflow**
3. Configure:
   - **Environment**: `prod`, `dev`, or `staging`
   - **Run seeders**: `true` or `false`
   - **Backends**: `all` or comma-separated list (e.g., `attendance,auth`)
4. Click **Run workflow**

### What It Does

The workflow will:
1. Install .NET SDK and EF Core tools
2. Connect to Azure SQL using service principal
3. Run `dotnet ef database update` for each selected backend
4. Optionally run seeders if enabled

### Example Scenarios

**Deploy new migration to production:**
```
Environment: prod
Run seeders: false
Backends: all
```

**Seed data in development:**
```
Environment: dev
Run seeders: true
Backends: all
```

**Update only AttendanceAPI schema:**
```
Environment: prod
Run seeders: false
Backends: attendance
```

## Manual Migration (Local or Azure CLI)

### Prerequisites

```bash
# Install EF Core tools
dotnet tool install --global dotnet-ef

# Azure login (if targeting Azure SQL)
az login
```

### Run Migrations

```bash
# Set connection string
export ConnectionStrings__DefaultConnection="Server=tcp:vermillion-sql-prod.database.windows.net,1433;Initial Catalog=AttendanceDB_prod;User ID=sqladmin;Password=YOUR_PASSWORD;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;ConnectRetryCount=3;ConnectRetryInterval=10;"

# Navigate to backend project
cd backend/AttendanceAPI

# Run migrations
dotnet ef database update --configuration Release
```

### Run Seeders Manually

```bash
# Set environment variables
export ConnectionStrings__DefaultConnection="YOUR_CONNECTION_STRING"
export SeedOnStartup=true
export RUN_MIGRATIONS=false

# Run the API (seeders execute on startup)
cd backend/AuthAPI
dotnet run --configuration Release
```

## Development Workflow

### Local Development

Migrations run automatically on startup in Development environment:
```json
// appsettings.Development.json
{
  "RunMigrations": true  // Default for Development
}
```

### Creating New Migrations

```bash
cd backend/AttendanceAPI
dotnet ef migrations add YourMigrationName
```

### Testing Migrations Before Production

1. Deploy to `dev` or `staging` environment
2. Run migrations workflow with `environment: dev`
3. Verify schema changes
4. Deploy to `prod` and run migrations

## Production Deployment Flow

### Option 1: Migrations Before Deployment (Recommended)
```
1. Merge code to main branch
2. Run "Run Database Migrations and Seeders" workflow (environment: prod)
3. Wait for migrations to complete
4. "Deploy Backend to Azure" workflow runs automatically
5. Apps start without running migrations (RUN_MIGRATIONS=false)
```

### Option 2: Migrations After Deployment
```
1. Ensure new code is backward-compatible with old schema
2. "Deploy Backend to Azure" workflow runs (apps start without migrations)
3. Run "Run Database Migrations and Seeders" workflow (environment: prod)
4. Schema updates without app restart
```

### Option 3: Enable Runtime Migrations (Not Recommended)

Override `RUN_MIGRATIONS` setting in Azure Portal:
```bash
az webapp config appsettings set \
  --name vermillion-attendance-api-prod \
  --resource-group vermillion-rg \
  --settings RUN_MIGRATIONS=true
```

**Warning**: This will run migrations on every app restart, which can cause startup timeouts if database is unreachable.

## Connection Retry Configuration

All connection strings include retry settings to handle transient failures:
- `ConnectRetryCount=3`: Retry up to 3 times on connection failure
- `ConnectRetryInterval=10`: Wait 10 seconds between retries

EF Core execution strategy also provides automatic retry with exponential backoff for transient SQL errors.

## Seeding Strategy

### AuthAPI Seeder
- Seeds default admin user and roles
- Controlled by `SeedOnStartup` config flag
- Safe to run multiple times (idempotent)

### EntryExitAPI Seeder
- Seeds initial entry/exit data if needed
- Controlled by `SeedOnStartup` config flag
- Safe to run multiple times (idempotent)

### AttendanceAPI
- No seeder currently implemented
- Add seeder if needed following the same pattern

## Troubleshooting

### Migration Fails with "Connection reset by peer"

**Cause**: Intermittent network/firewall issue between GitHub Actions runner and Azure SQL

**Solution**: The workflow has built-in retry logic. If it still fails:
1. Check SQL firewall rules allow GitHub Actions IPs
2. Verify SQL admin credentials are correct
3. Try running from local machine with Azure VPN

### Seeder Times Out

**Cause**: Seeder runs via `timeout 60s dotnet run` to prevent hanging

**Solution**: 
1. Increase timeout if seeding large datasets
2. Check seeder logs for errors
3. Run seeder manually for better diagnostics

### Migration Shows "No migrations pending"

**Cause**: Schema is already up to date

**Solution**: This is normal. No action needed.

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RUN_MIGRATIONS` | `false` (prod) | Whether to run migrations on app startup |
| `SeedOnStartup` | `false` | Whether to run seeders on app startup |
| `RunMigrations` | Development only | Config-based migration control |

### Connection String Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `Connection Timeout` | 30 | Initial connection timeout (seconds) |
| `ConnectRetryCount` | 3 | Number of connection retry attempts |
| `ConnectRetryInterval` | 10 | Delay between retries (seconds) |

## Best Practices

1. **Always test migrations in dev/staging first**
2. **Use migration workflow for production** (don't rely on runtime migrations)
3. **Keep migrations backward-compatible** when possible
4. **Run seeders only when needed** (not on every deployment)
5. **Monitor migration logs** in GitHub Actions for errors
6. **Coordinate migrations with deployments** to avoid schema version mismatches

## See Also

- [Azure Infrastructure Setup](./CLAUDE_SETUP.md)
- [GitHub Actions Workflows](../.github/workflows/)
- [EF Core Migrations Documentation](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/)
