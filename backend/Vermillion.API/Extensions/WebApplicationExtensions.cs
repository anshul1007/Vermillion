using Microsoft.EntityFrameworkCore;
using Vermillion.API.Middleware;
using Vermillion.Auth.Domain.Data;
using Vermillion.Auth.Domain.Services;
using Vermillion.Attendance.Domain.Data;
using Vermillion.EntryExit.Domain.Data;
using Vermillion.EntryExit.Domain.Services;
using Vermillion.Shared.Domain.Data;
using Vermillion.Shared.Domain.Services;

namespace Vermillion.API.Extensions;

/// <summary>
/// Extension methods for WebApplication to organize middleware and startup configuration
/// </summary>
public static class WebApplicationExtensions
{
    /// <summary>
    /// Configures the HTTP request pipeline middleware
    /// </summary>
    public static WebApplication UseVermillionMiddleware(this WebApplication app)
    {
        // Global exception handler (must be first in pipeline)
        app.UseGlobalExceptionHandler();

        // Response compression (early in pipeline for maximum benefit)
        app.UseResponseCompression();

        // Swagger in development
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI(c =>
            {
                c.SwaggerEndpoint("/swagger/v1/swagger.json", "Vermillion API v1");
            });
        }

        app.UseHttpsRedirection();
        
        // CORS must come before Authentication/Authorization
        app.UseCors("AllowConfiguredOrigins");
        
        app.UseAuthentication();
        app.UseAuthorization();

        // Serve static files (for photos in EntryExit domain)
        app.UseStaticFiles();

        app.MapControllers();

        return app;
    }

    /// <summary>
    /// Runs database migrations and seeders
    /// </summary>
    public static async Task<WebApplication> MigrateAndSeedDatabasesAsync(
        this WebApplication app,
        IConfiguration configuration,
        ILogger logger)
    {
        // Determine if we should run migrations
        var runMigrationsEnv = Environment.GetEnvironmentVariable("RUN_MIGRATIONS");
        bool runMigrations = false;

        if (!string.IsNullOrEmpty(runMigrationsEnv))
        {
            runMigrations = string.Equals(runMigrationsEnv, "true", StringComparison.OrdinalIgnoreCase);
            logger.LogInformation("RUN_MIGRATIONS environment variable detected: {RunMigrations}", runMigrationsEnv);
        }

        // Determine if we should seed
        var seedOnStartupEnv = Environment.GetEnvironmentVariable("SeedOnStartup");
        bool shouldSeed = false;

        if (!string.IsNullOrEmpty(seedOnStartupEnv))
        {
            shouldSeed = string.Equals(seedOnStartupEnv, "true", StringComparison.OrdinalIgnoreCase);
            logger.LogInformation("SeedOnStartup environment variable detected: {SeedOnStartup}", seedOnStartupEnv);
        }

        if (!runMigrations && !shouldSeed)
        {
            logger.LogInformation("Skipping migrations and seeding entirely (flags disabled).");
            return app;
        }

        using var scope = app.Services.CreateScope();
        var services = scope.ServiceProvider;

        if (runMigrations)
        {
            try
            {
                // Migrate Auth domain
                logger.LogInformation("Applying Auth domain migrations...");
                var authContext = services.GetRequiredService<AuthDbContext>();
                await authContext.Database.MigrateAsync();
                logger.LogInformation("Auth migrations applied successfully");

                // Migrate Attendance domain
                logger.LogInformation("Applying Attendance domain migrations...");
                var attendanceContext = services.GetRequiredService<AttendanceDbContext>();
                await attendanceContext.Database.MigrateAsync();
                logger.LogInformation("Attendance migrations applied successfully");

                // Migrate EntryExit domain
                logger.LogInformation("Applying EntryExit domain migrations...");
                var entryExitContext = services.GetRequiredService<EntryExitDbContext>();
                await entryExitContext.Database.MigrateAsync();
                logger.LogInformation("EntryExit migrations applied successfully");

                // Migrate Shared domain
                logger.LogInformation("Applying Shared domain migrations...");
                var sharedContext = services.GetRequiredService<SharedDbContext>();
                await sharedContext.Database.MigrateAsync();
                logger.LogInformation("Shared migrations applied successfully");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "An error occurred while migrating databases");
                throw;
            }
        }
        else
        {
            logger.LogInformation("Skipping automatic database migrations (RUN_MIGRATIONS not set)");
        }

        if (shouldSeed)
        {
            try
            {
                // Seed Auth domain
                var identitySeeder = services.GetRequiredService<IdentitySeeder>();
                logger.LogInformation("Running identity seeder...");
                await identitySeeder.SeedAsync();
                logger.LogInformation("Identity seeder executed successfully");

                // Seed Shared domain (must run after Auth since sample audit logs reference user IDs)
                var sharedSeeder = services.GetRequiredService<SharedSeeder>();
                logger.LogInformation("Running shared infrastructure seeder...");
                await sharedSeeder.SeedAsync();
                logger.LogInformation("Shared seeder executed successfully");

                // Seed EntryExit domain
                var entryExitSeeder = services.GetRequiredService<EntryExitSeeder>();
                logger.LogInformation("Running entry/exit seeder...");
                await entryExitSeeder.SeedAsync();
                logger.LogInformation("Entry/Exit seeder executed successfully");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "An error occurred while seeding databases");
                throw;
            }
        }
        else
        {
            logger.LogInformation("Skipping seeding (SeedOnStartup not enabled)");
        }

        return app;
    }
}
