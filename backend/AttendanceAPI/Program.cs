using AttendanceAPI.Data;
using AttendanceAPI.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.FeatureManagement;

var builder = WebApplication.CreateBuilder(args);

var defaultConn = builder.Configuration.GetConnectionString("DefaultConnection")
                  ?? throw new InvalidOperationException("DefaultConnection is not configured");

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(defaultConn);
});

var jwtConfig = builder.Configuration.GetSection("Jwt");
var secretKey = jwtConfig["Key"] ?? throw new InvalidOperationException("JWT Key not configured");

// Create logger factory early for JWT events
var loggerFactory = LoggerFactory.Create(loggingBuilder => 
{
    loggingBuilder.AddConfiguration(builder.Configuration.GetSection("Logging"));
    loggingBuilder.AddConsole();
});
var jwtAuthLogger = loggerFactory.CreateLogger("JwtAuth");
var jwtMappingLogger = loggerFactory.CreateLogger("JwtAuthMapping");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtConfig["Issuer"],
        ValidAudience = jwtConfig["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
        // Use the standard role claim type so [Authorize(Roles=..)] checks the typical role claim URI
        RoleClaimType = System.Security.Claims.ClaimTypes.Role,
        ClockSkew = TimeSpan.Zero
    };
    // Add diagnostic logging for token validation failures and successes
    options.Events = new JwtBearerEvents
    {
        OnAuthenticationFailed = context =>
        {
            jwtAuthLogger.LogWarning(context.Exception, "JWT authentication failed: {Message}", context.Exception.Message);
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            var sub = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? context.Principal?.FindFirst("sub")?.Value;
            jwtAuthLogger.LogInformation("JWT validated for sub={Sub}, name={Name}", sub, context.Principal?.Identity?.Name);
            // Ensure role claims from different JWT shapes are available as ClaimTypes.Role
            try
            {
                var jwtToken = context.SecurityToken as System.IdentityModel.Tokens.Jwt.JwtSecurityToken;
                if (jwtToken != null)
                {
                    var identity = context.Principal?.Identity as System.Security.Claims.ClaimsIdentity;
                    if (identity != null)
                    {
                        void AddRoleClaim(string? rv)
                        {
                            if (!string.IsNullOrEmpty(rv))
                            {
                                // avoid duplicate role claims
                                var principal = context.Principal;
                                if (principal != null && !principal.HasClaim(System.Security.Claims.ClaimTypes.Role, rv))
                                    identity.AddClaim(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, rv));
                            }
                        }

                        object? tryGet(string key)
                        {
                            return jwtToken.Payload.TryGetValue(key, out var v) ? v : null;
                        }

                        // Helper to handle JsonElement, arrays, or plain values
                        void HandleRoleObject(object? roleObj)
                        {
                            if (roleObj == null) return;

                            // JsonElement (System.Text.Json) is commonly present when tokens are parsed
                            if (roleObj is System.Text.Json.JsonElement je)
                            {
                                if (je.ValueKind == System.Text.Json.JsonValueKind.Array)
                                {
                                    foreach (var el in je.EnumerateArray())
                                    {
                                        if (el.ValueKind == System.Text.Json.JsonValueKind.String)
                                            AddRoleClaim(el.GetString());
                                        else
                                            AddRoleClaim(el.ToString());
                                    }
                                }
                                else if (je.ValueKind == System.Text.Json.JsonValueKind.String)
                                {
                                    AddRoleClaim(je.GetString());
                                }
                                else
                                {
                                    AddRoleClaim(je.ToString());
                                }
                                return;
                            }

                            // If it's an enumerable (but not string), enumerate
                            if (roleObj is System.Collections.IEnumerable ie && !(roleObj is string))
                            {
                                foreach (var r in ie)
                                {
                                    AddRoleClaim(r?.ToString());
                                }
                                return;
                            }

                            // Fallback
                            AddRoleClaim(roleObj?.ToString());
                        }

                        // Check common claim shapes
                        var r1 = tryGet("roles");
                        var r2 = tryGet("role");
                        var r3 = tryGet(System.Security.Claims.ClaimTypes.Role);
                        var r4 = tryGet("http://schemas.microsoft.com/ws/2008/06/identity/claims/role");
                        HandleRoleObject(r1);
                        HandleRoleObject(r2);
                        HandleRoleObject(r3);
                        HandleRoleObject(r4);
                    }
                }
            }
            catch (Exception ex)
            {
                // non-fatal mapping errors should not block auth; log for diagnostics
                jwtMappingLogger.LogWarning(ex, "Role mapping from token payload failed: {Message}", ex.Message);
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:4200", "http://localhost:8100", "capacitor://localhost", "http://localhost")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddHttpContextAccessor();

// Register CurrentUserService for resolving authenticated user ID from claims
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();

// Register TeamManagementHelper for shared team member logic
builder.Services.AddScoped<ITeamManagementHelper, TeamManagementHelper>();

// AuthAPI client with caching - configure base address via configuration 'AuthApi:BaseUrl'
var authApiBase = builder.Configuration["AuthApi:BaseUrl"] ?? "https://localhost:5001";
builder.Services.AddHttpClient<AuthApiClient>(client =>
{
    client.BaseAddress = new Uri(authApiBase);
});
// Wrap AuthApiClient with caching decorator
builder.Services.AddScoped<IAuthApiClient>(provider =>
{
    var innerClient = provider.GetRequiredService<AuthApiClient>();
    var logger = provider.GetRequiredService<ILogger<CachedAuthApiClient>>();
    var durationSeconds = provider.GetRequiredService<IConfiguration>().GetValue("AuthApiCache:DurationSeconds", 60);
    var cacheDuration = TimeSpan.FromSeconds(durationSeconds);
    return new CachedAuthApiClient(innerClient, logger, cacheDuration);
});

builder.Services.AddFeatureManagement()
    .AddFeatureFilter<Microsoft.FeatureManagement.FeatureFilters.TimeWindowFilter>();

builder.Services.AddSingleton<IFeatureDefinitionProvider, DatabaseFeatureDefinitionProvider>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Apply migrations
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    var config = services.GetRequiredService<IConfiguration>();
    var env = services.GetRequiredService<IHostEnvironment>();
    
    // Check if migrations should run
    // Priority: Environment variable RUN_MIGRATIONS > Config RunMigrations > Default (Development only)
    var runMigrationsEnv = Environment.GetEnvironmentVariable("RUN_MIGRATIONS");
    bool runMigrations;
    
    if (!string.IsNullOrEmpty(runMigrationsEnv))
    {
        // Explicit environment variable takes highest priority
        runMigrations = string.Equals(runMigrationsEnv, "true", StringComparison.OrdinalIgnoreCase);
        logger.LogInformation($"RUN_MIGRATIONS environment variable detected: {runMigrationsEnv}");
    }
    else
    {
        // Fall back to config or Development environment
        var runMigrationsConfig = config.GetValue<bool?>("RunMigrations");
        runMigrations = runMigrationsConfig ?? env.IsDevelopment();
    }
    
    if (runMigrations)
    {
        try
        {
            var context = services.GetRequiredService<ApplicationDbContext>();
            logger.LogInformation("Applying pending migrations...");
            
            // Use execution strategy for retry on transient failures
            var strategy = context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await context.Database.MigrateAsync();
            });
            
            logger.LogInformation("Migrations applied successfully.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "An error occurred while migrating the database.");
            throw;
        }
    }
    else
    {
        logger.LogInformation("Migrations skipped (RunMigrations=false).");
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
