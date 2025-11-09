using EntryExitAPI.Data;
using EntryExitAPI.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

var defaultConn = builder.Configuration.GetConnectionString("DefaultConnection")
                  ?? throw new InvalidOperationException("DefaultConnection is not configured");

builder.Services.AddDbContext<EntryExitDbContext>(options =>
{
    options.UseSqlServer(defaultConn);
});

builder.Services.AddDataProtection();

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
    options.AddPolicy("AllowMobile", policy =>
    {
        policy.WithOrigins(
            "http://localhost:4200",
            "http://localhost:8100",
            "capacitor://localhost",
            "ionic://localhost",
            "http://localhost"
        )
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials();
    });
});

// Register HttpContextAccessor for AuthApiClient
builder.Services.AddHttpContextAccessor();

// Register AuthApiClient with HttpClient
builder.Services.AddHttpClient<AuthApiClient>(client =>
{
    var authApiUrl = builder.Configuration["AuthApiBaseUrl"] ?? "http://localhost:5275";
    client.BaseAddress = new Uri(authApiUrl);
    client.Timeout = TimeSpan.FromSeconds(30);
});

// Register CachedAuthApiClient as decorator
builder.Services.AddScoped<IAuthApiClient>(serviceProvider =>
{
    var authApiClient = serviceProvider.GetRequiredService<AuthApiClient>();
    var logger = serviceProvider.GetRequiredService<ILogger<CachedAuthApiClient>>();
    return new CachedAuthApiClient(authApiClient, logger, TimeSpan.FromMinutes(5));
});

builder.Services.AddScoped<IEncryptionService, EncryptionService>();
builder.Services.AddScoped<IPhotoStorageService, LocalPhotoStorageService>();
builder.Services.AddScoped<ILabourService, LabourService>();
builder.Services.AddScoped<IVisitorService, VisitorService>();
builder.Services.AddScoped<IEntryExitRecordService, EntryExitRecordService>();
builder.Services.AddScoped<ISyncService, SyncService>();
builder.Services.AddScoped<IAdminService, AdminService>();
builder.Services.AddScoped<EntryExitSeeder>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Entry/Exit Management API",
        Version = "v1",
        Description = "API for managing site worker and visitor entry/exit records with offline sync support"
    });

    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token.",
        Name = "Authorization",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Configure AuthApi HttpClient for lookups from seeders (must be registered before Build())
var authApiBase = builder.Configuration["AuthApi:BaseUrl"] ?? "https://localhost:5001";
builder.Services.AddHttpClient("AuthApiClient", client => client.BaseAddress = new Uri(authApiBase));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    var config = services.GetRequiredService<IConfiguration>();
    var env = services.GetRequiredService<IHostEnvironment>();
    
    // Check if migrations should run
    var runMigrations = config.GetValue("RunMigrations", env.IsDevelopment());
    var runMigrationsEnv = Environment.GetEnvironmentVariable("RUN_MIGRATIONS");
    if (!string.IsNullOrEmpty(runMigrationsEnv))
    {
        runMigrations = bool.Parse(runMigrationsEnv);
    }
    
    if (runMigrations)
    {
        try
        {
            var context = services.GetRequiredService<EntryExitDbContext>();
            logger.LogInformation("Applying pending migrations...");
            
            // Use execution strategy for retry on transient failures
            var strategy = context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await context.Database.MigrateAsync();
            });
            
            logger.LogInformation("Migrations applied successfully.");
            
            var seedFlag = config.GetValue("SeedOnStartup", false);
            if (env.IsDevelopment() || seedFlag)
            {
                var seeder = services.GetRequiredService<EntryExitSeeder>();
                await seeder.SeedAsync();
                logger.LogInformation("EntryExit seeder executed.");
            }
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

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseCors("AllowMobile");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
